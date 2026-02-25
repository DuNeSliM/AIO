import { useEffect, useState } from 'react'
import { API_BASE } from '../services/api'
import { useI18n } from '../i18n/i18n'
import { STORAGE_KEYS } from '../shared/storage/keys'
import {
  getLocalString,
  removeLocalString,
  setLocalString,
} from '../shared/storage/storage'

type SteamAuth = {
  steamId: string | null
  username: string | null
  isLoggedIn: boolean
  login: () => void
  logout: () => void
}

export function useSteamAuth(): SteamAuth {
  const { t } = useI18n()
  const [steamId, setSteamId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('steamid')
    const name = params.get('username')

    if (id) {
      setSteamId(id)
      setUsername(name || t('auth.steamUserFallback'))

      setLocalString(STORAGE_KEYS.steam.id, id)
      if (name) setLocalString(STORAGE_KEYS.steam.username, name)

      window.history.replaceState({}, '', window.location.pathname)
    } else {
      const storedId = getLocalString(STORAGE_KEYS.steam.id)
      const storedName = getLocalString(STORAGE_KEYS.steam.username)
      if (storedId) {
        setSteamId(storedId)
        setUsername(storedName)
      }
    }
  }, [t])

  const login = () => {
    window.location.href = `${API_BASE}/v1/steam/login`
  }

  const logout = () => {
    setSteamId(null)
    setUsername(null)
    removeLocalString(STORAGE_KEYS.steam.id)
    removeLocalString(STORAGE_KEYS.steam.username)
  }

  return { steamId, username, isLoggedIn: !!steamId, login, logout }
}
