import type { AuthResponse, Game, ItadPricesResponse, ItadSearchItem, User } from '../types'

export const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const AUTH_TOKEN_STORAGE_KEYS = ['accessToken', 'authAccessToken', 'authToken', 'keycloakAccessToken'] as const
const REFRESH_TOKEN_STORAGE_KEYS = ['refreshToken', 'authRefreshToken'] as const

function getStoredValue(keys: readonly string[]): string | null {
  if (typeof window === 'undefined') return null

  for (const key of keys) {
    const sessionToken = sessionStorage.getItem(key)?.trim()
    if (sessionToken) return sessionToken

    const localToken = localStorage.getItem(key)?.trim()
    if (localToken) return localToken
  }

  return null
}

function getStoredToken(): string | null {
  return getStoredValue(AUTH_TOKEN_STORAGE_KEYS)
}

function getStoredRefreshToken(): string | null {
  return getStoredValue(REFRESH_TOKEN_STORAGE_KEYS)
}

function decodeJwt(token: string): { exp?: number } {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return {}

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    return payload
  } catch {
    return {}
  }
}

export function isTokenExpiringSoon(token: string, thresholdSeconds = 300): boolean {
  const decoded = decodeJwt(token)
  if (!decoded.exp) return false
  const now = Math.floor(Date.now() / 1000)
  return decoded.exp - now < thresholdSeconds
}

export function clearPersistedAuthTokens() {
  if (typeof window === 'undefined') return

  const keys = new Set<string>([
    ...AUTH_TOKEN_STORAGE_KEYS,
    ...REFRESH_TOKEN_STORAGE_KEYS,
    'accessToken',
    'refreshToken',
    'user',
  ])

  keys.forEach((key) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  })
}

export function clearAuthTokens(): void {
  clearPersistedAuthTokens()
}

function persistAuthTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('accessToken', accessToken)
  sessionStorage.setItem('accessToken', accessToken)
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken)
    sessionStorage.setItem('refreshToken', refreshToken)
  }
}

function resolveAuthToken(): string | null {
  const stored = getStoredToken()
  if (stored) return stored
  return null
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      clearPersistedAuthTokens()
      return null
    }

    const payload = (await res.json()) as { accessToken?: string; refreshToken?: string }
    const nextAccess = payload.accessToken?.trim()
    if (!nextAccess) {
      clearPersistedAuthTokens()
      return null
    }

    persistAuthTokens(nextAccess, payload.refreshToken?.trim())
    return nextAccess
  } catch {
    clearPersistedAuthTokens()
    return null
  }
}

function withAuth(opts?: RequestInit): RequestInit {
  const token = resolveAuthToken()
  if (!token) return opts ?? {}

  const headers = new Headers(opts?.headers)
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return { ...opts, headers }
}

function withToken(opts: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(opts?.headers)
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return { ...opts, headers }
}

async function fetchWithAuth(url: string, opts?: RequestInit): Promise<Response> {
  const first = await fetch(url, withAuth(opts))
  if (first.status !== 401) return first

  const refreshedAccess = await tryRefreshToken()
  if (!refreshedAccess) return first

  return fetch(url, withToken(opts, refreshedAccess))
}

export async function ensureValidToken(): Promise<string | null> {
  const accessToken = resolveAuthToken()
  if (!accessToken) return null

  if (!isTokenExpiringSoon(accessToken)) {
    return accessToken
  }

  return tryRefreshToken()
}

export async function authenticatedFetch<T = unknown>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const token = await ensureValidToken()
    if (!token) return null

    const res = await fetchWithAuth(url, withToken(opts, token))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } catch (error) {
    console.error('Authenticated API Error:', error)
    return null
  }
}

async function tryJson<T = unknown>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetchWithAuth(url, opts)
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

async function readResponseErrorMessage(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.includes('application/json')) {
    try {
      const payload = (await res.json()) as { error?: string; message?: string }
      const msg = payload.message?.trim() || payload.error?.trim()
      if (msg) return msg
    } catch {
      // fall back to text
    }
  }

  try {
    const body = (await res.text()).trim()
    if (body) return body
  } catch {
    // ignore read errors
  }

  return fallback
}

export async function fetchGames(): Promise<Game[]> {
  const res = await tryJson<Game[] | { error?: unknown }>(`${API_BASE}/v1/games/installed`)
  if (Array.isArray(res)) return res
  if (res && !('error' in res)) return res as Game[]
  return []
}

export async function fetchSteamLibrary(steamId: string): Promise<Game[]> {
  if (!steamId) return []
  const res = await fetchWithAuth(`${API_BASE}/v1/steam/library?steamid=${encodeURIComponent(steamId)}`)
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
  const res = await fetchWithAuth(`${API_BASE}/v1/steam/wishlist?steamid=${encodeURIComponent(steamId)}`)
  if (!res.ok) throw await readApiError(res)
  const data = (await res.json()) as SteamWishlistEntry[]
  return Array.isArray(data) ? data : []
}

export async function syncSteamWishlistToBackend(appIds: number[]): Promise<void> {
  const unique = Array.from(new Set(appIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (unique.length === 0) return

  const res = await fetchWithAuth(`${API_BASE}/v1/steam/wishlist/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appIds: unique }),
  })
  if (!res.ok) throw await readApiError(res)
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

    const res = await fetchWithAuth(url, { method: 'POST' })
    if (!res.ok) throw new Error(`Launch failed: ${res.status}`)
    return await res.json()
  } catch (error) {
    console.error('Launch error:', error)
    throw error
  }
}

export async function syncStore(store: string, credentials?: { steamId?: string; accessToken?: string }) {
  let url
  let headers: HeadersInit | undefined
  if (store === 'steam' && credentials?.steamId) {
    url = `${API_BASE}/v1/steam/sync?steamid=${encodeURIComponent(credentials.steamId)}`
  } else if (store === 'epic' && credentials?.accessToken) {
    url = `${API_BASE}/v1/epic/sync`
    headers = { Authorization: `Bearer ${credentials.accessToken}` }
  } else {
    url = `${API_BASE}/v1/games/${store}/library`
  }

  const res = await tryJson(url, { method: 'POST', headers })
  if (res && !(res as { error?: unknown }).error) return res

  await new Promise((resolve) => setTimeout(resolve, 700))
  return { ok: true }
}

export async function register(
  username: string,
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
): Promise<User> {
  const res = await fetch(`${API_BASE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, firstName, lastName }),
  })
  if (!res.ok) {
    throw new Error(await readResponseErrorMessage(res, 'Registration failed'))
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
    throw new Error(await readResponseErrorMessage(res, 'Login failed'))
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

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    throw new Error(await readResponseErrorMessage(res, 'Token refresh failed'))
  }
  return (await res.json()) as AuthResponse
}

export async function getMe(accessToken: string): Promise<User> {
  const res = await fetch(`${API_BASE}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(await readResponseErrorMessage(res, 'Failed to get user info'))
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
    throw new Error(await readResponseErrorMessage(res, 'Failed to request password reset'))
  }
  return (await res.json()) as { message: string }
}
