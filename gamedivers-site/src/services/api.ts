import type { Game, ItadPricesResponse, ItadSearchItem, User, AuthResponse } from '../types'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'user'

// Decode JWT token and extract expiration time
function decodeJwt(token: string): { exp?: number } {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return {}
    const decoded = JSON.parse(atob(parts[1]))
    return decoded
  } catch {
    return {}
  }
}

// Check if token is expiring soon (within 5 minutes)
export function isTokenExpiringSoon(token: string, thresholdSeconds = 300): boolean {
  const decoded = decodeJwt(token)
  if (!decoded.exp) return false
  const now = Math.floor(Date.now() / 1000)
  return decoded.exp - now < thresholdSeconds
}

// Clear auth tokens from localStorage
export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// Refresh token if it's expiring soon
export async function ensureValidToken(): Promise<string | null> {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

  if (!accessToken || !refreshToken) return null

  // If token is expiring soon, refresh it
  if (isTokenExpiringSoon(accessToken)) {
    try {
      const newTokens = await refreshTokenRequest(refreshToken)
      localStorage.setItem(ACCESS_TOKEN_KEY, newTokens.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, newTokens.refreshToken)
      return newTokens.accessToken
    } catch (err) {
      console.error('Token refresh failed:', err)
      clearAuthTokens()
      return null
    }
  }

  return accessToken
}

// Make authenticated API calls with automatic token refresh
export async function authenticatedFetch<T = unknown>(
  url: string,
  opts?: RequestInit,
): Promise<T | null> {
  try {
    // Ensure token is valid before making request
    const accessToken = await ensureValidToken()
    if (!accessToken) {
      return null
    }

    const headers = new Headers(opts?.headers || {})
    headers.set('Authorization', `Bearer ${accessToken}`)

    const res = await fetch(url, { ...opts, headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } catch (error) {
    console.error('Authenticated API Error:', error)
    return null
  }
}

async function tryJson<T = unknown>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, opts)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } catch (error) {
    console.error('API Error:', error)
    return null
  }
}

async function readApiError(res: Response): Promise<Error> {
  try {
    const data = (await res.json()) as { error?: string }
    if (data?.error === 'steam_profile_private') return new Error('steam-private')
    if (data?.error === 'steam_wishlist_blocked') return new Error('steam-wishlist-blocked')
  } catch {
    // ignore parse failures
  }
  return new Error(`HTTP ${res.status}`)
}

export async function fetchGames(): Promise<Game[]> {
  const res = await tryJson<Game[] | { error?: unknown }>(`${API_BASE}/v1/games/installed`)
  if (Array.isArray(res)) return res
  if (res && !('error' in res)) return res as Game[]
  return []
}

export async function fetchSteamLibrary(steamId: string): Promise<Game[]> {
  if (!steamId) return []
  const res = await fetch(`${API_BASE}/v1/steam/library?steamid=${steamId}`)
  if (!res.ok) throw await readApiError(res)
  const data = (await res.json()) as Game[]
  return Array.isArray(data) ? data : []
}

export async function fetchEpicLibrary(): Promise<Game[]> {
  const res = await tryJson<Game[]>(`${API_BASE}/v1/games/epic/library`)
  return Array.isArray(res) ? res : []
}

export type SteamWishlistEntry = {
  appId: number
  name: string
  added?: number
  capsule?: string
}

export async function fetchSteamWishlist(steamId: string): Promise<SteamWishlistEntry[]> {
  if (!steamId) return []
  const res = await fetch(`${API_BASE}/v1/steam/wishlist?steamid=${steamId}`)
  if (!res.ok) throw await readApiError(res)
  const data = (await res.json()) as SteamWishlistEntry[]
  return Array.isArray(data) ? data : []
}

export async function searchItad(
  query: string,
  limit = 10,
): Promise<ItadSearchItem[] | { data?: ItadSearchItem[]; results?: ItadSearchItem[] }> {
  const url = `${API_BASE}/v1/itad/search?q=${encodeURIComponent(query)}&limit=${limit}`
  const res = await tryJson<ItadSearchItem[] | { data?: ItadSearchItem[]; results?: ItadSearchItem[] }>(url)
  if (!res) throw new Error('API nicht erreichbar')
  if (Array.isArray(res)) return res
  return res
}

export async function getItadPrices(gameId: string, country = 'DE'): Promise<ItadPricesResponse> {
  const url = `${API_BASE}/v1/itad/games/${encodeURIComponent(gameId)}/prices?country=${country}`
  const res = await tryJson<ItadPricesResponse>(url)
  if (!res) throw new Error('API nicht erreichbar')
  return res
}

export async function launchGame(platform: string, id: string | number, appName?: string) {
  try {
    if (typeof window !== 'undefined' && (window as Window & { __TAURI__?: unknown }).__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke('launch_game', { platform, id, appName })
    }

    let url
    switch (platform) {
      case 'steam':
        url = `${API_BASE}/v1/games/steam/${id}/start`
        break
      case 'epic':
        url = `${API_BASE}/v1/games/epic/${encodeURIComponent(appName || String(id))}/start`
        break
      case 'gog':
        url = `${API_BASE}/v1/games/gog/${encodeURIComponent(appName || String(id))}/start`
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    const res = await fetch(url, { method: 'POST' })
    if (!res.ok) throw new Error(`Launch failed: ${res.status}`)
    return await res.json()
  } catch (error) {
    console.error('Launch error:', error)
    throw error
  }
}

export async function syncStore(store: string, credentials?: { steamId?: string; accessToken?: string }) {
  let url
  if (store === 'steam' && credentials?.steamId) {
    url = `${API_BASE}/v1/steam/sync?steamid=${credentials.steamId}`
  } else if (store === 'epic' && credentials?.accessToken) {
    url = `${API_BASE}/v1/epic/sync?access_token=${credentials.accessToken}`
  } else {
    url = `${API_BASE}/v1/games/${store}/library`
  }

  const res = await tryJson(url, { method: 'POST' })
  if (res && !(res as { error?: unknown }).error) return res

  await new Promise((resolve) => setTimeout(resolve, 700))
  return { ok: true }
}

// Auth endpoints
export async function register(username: string, email: string, password: string, firstName?: string, lastName?: string): Promise<User> {
  const res = await fetch(`${API_BASE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, firstName, lastName }),
  })
  if (!res.ok) {
    const error = await res.json() as { error?: string; message?: string }
    throw new Error(error.message || error.error || 'Registration failed')
  }
  return (await res.json()) as User
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const error = await res.json() as { error?: string; message?: string }
    throw new Error(error.message || error.error || 'Login failed')
  }
  return (await res.json()) as AuthResponse
}

export async function logout(refreshToken: string): Promise<void> {
  await fetch(`${API_BASE}/v1/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
}

async function refreshTokenRequest(refreshToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    // Clear tokens if refresh fails
    clearAuthTokens()
    throw new Error('Token refresh failed')
  }
  return (await res.json()) as AuthResponse
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  return refreshTokenRequest(refreshToken)
}

export async function getMe(accessToken: string): Promise<User> {
  const res = await fetch(`${API_BASE}/v1/auth/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error('Failed to get user info')
  }
  return (await res.json()) as User
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const error = await res.json() as { error?: string; message?: string }
    throw new Error(error.message || error.error || 'Failed to request password reset')
  }
  return (await res.json()) as { message: string }
}
