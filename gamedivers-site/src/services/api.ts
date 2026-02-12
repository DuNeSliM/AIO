import type { Game, ItadPricesResponse, ItadSearchItem } from '../types'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

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
  let headers: HeadersInit | undefined
  if (store === 'steam' && credentials?.steamId) {
    url = `${API_BASE}/v1/steam/sync?steamid=${credentials.steamId}`
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
