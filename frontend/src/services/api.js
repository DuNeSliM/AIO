// API integration with backend and Tauri
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

async function tryJson(url, opts){
  try{
    const res = await fetch(url, opts)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  }catch(e){
    console.error('API Error:', e)
    return null
  }
}

// Fetch all games from backend /v1/games/installed
export async function fetchGames(){
  const res = await tryJson(`${API_BASE}/v1/games/installed`)
  if (res && !res.error) return res

  // Fallback mocked games for development
  return []
}

// Fetch Steam library for authenticated user
export async function fetchSteamLibrary(steamId){
  if (!steamId) return []
  const res = await tryJson(`${API_BASE}/v1/steam/library?steamid=${steamId}`)
  if (res && Array.isArray(res)) return res
  return []
}

// Fetch Epic Games library for authenticated user
export async function fetchEpicLibrary(){
  const res = await tryJson(`${API_BASE}/v1/games/epic/library`)
  if (res && Array.isArray(res)) return res
  return []
}

// Launch game via Tauri command or backend endpoint
export async function launchGame(platform, id, appName){
  try{
    // Try Tauri first if available
    if (typeof window !== 'undefined' && window.__TAURI__){
      const { invoke } = await import('@tauri-apps/api/tauri')
      return await invoke('launch_game', { platform, id, appName })
    }

    // Fallback to backend HTTP endpoints
    let url
    switch(platform){
      case 'steam':
        url = `${API_BASE}/v1/games/steam/${id}/start`
        break
      case 'epic':
        url = `${API_BASE}/v1/games/epic/${encodeURIComponent(appName || id)}/start`
        break
      case 'gog':
        url = `${API_BASE}/v1/games/gog/${encodeURIComponent(appName || id)}/start`
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    const res = await fetch(url, {method: 'POST'})
    if (!res.ok) throw new Error(`Launch failed: ${res.status}`)
    return await res.json()
  }catch(e){
    console.error('Launch error:', e)
    throw e
  }
}

// Sync library from store (Steam/Epic/GOG)
export async function syncStore(store, credentials){
  let url
  if (store === 'steam' && credentials?.steamId) {
    url = `${API_BASE}/v1/steam/sync?steamid=${credentials.steamId}`
  } else if (store === 'epic' && credentials?.accessToken) {
    url = `${API_BASE}/v1/epic/sync?access_token=${credentials.accessToken}`
  } else {
    url = `${API_BASE}/v1/games/${store}/library`
  }
  
  const res = await tryJson(url, {method: 'POST'})
  if (res && !res.error) return res

  // Simulate sync for development
  await new Promise(r => setTimeout(r, 700))
  return {ok: true}
}
