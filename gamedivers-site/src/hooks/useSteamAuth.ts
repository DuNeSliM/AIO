import { useEffect, useState } from 'react'

type SteamAuth = {
  steamId: string | null
  username: string | null
  isLoggedIn: boolean
  login: () => void
  logout: () => void
}

export function useSteamAuth(): SteamAuth {
  const [steamId, setSteamId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('steamid')
    const name = params.get('username')

    if (id) {
      setSteamId(id)
      setUsername(name || 'Steam User')

      localStorage.setItem('steamId', id)
      if (name) localStorage.setItem('steamUsername', name)

      window.history.replaceState({}, '', window.location.pathname)
    } else {
      const storedId = localStorage.getItem('steamId')
      const storedName = localStorage.getItem('steamUsername')
      if (storedId) {
        setSteamId(storedId)
        setUsername(storedName)
      }
    }
  }, [])

  const login = () => {
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
    window.location.href = `${API_BASE}/v1/steam/login`
  }

  const logout = () => {
    setSteamId(null)
    setUsername(null)
    localStorage.removeItem('steamId')
    localStorage.removeItem('steamUsername')
  }

  return { steamId, username, isLoggedIn: !!steamId, login, logout }
}
