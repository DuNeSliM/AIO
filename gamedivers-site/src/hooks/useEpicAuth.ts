import { useEffect, useState } from 'react'
import { API_BASE } from '../services/api'
import { STORAGE_KEYS } from '../shared/storage/keys'
import {
  getLocalString,
  getSessionString,
  removeLocalString,
  removeSessionString,
  setLocalString,
  setSessionString,
} from '../shared/storage/storage'

type EpicAuth = {
  epicId: string | null
  username: string | null
  accessToken: string | null
  isLoggedIn: boolean
  login: () => void
  logout: () => void
}

export function useEpicAuth(): EpicAuth {
  const [epicId, setEpicId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const hashParams = new URLSearchParams(hash)

    const id = hashParams.get('epicid') || queryParams.get('epicid')
    const name = hashParams.get('username') || queryParams.get('username')
    const token = hashParams.get('access_token') || queryParams.get('access_token')

    if (id) {
      setEpicId(id)
      setUsername(name || 'Epic User')
      setAccessToken(token)

      setLocalString(STORAGE_KEYS.epic.id, id)
      if (name) setLocalString(STORAGE_KEYS.epic.username, name)
      if (token) setSessionString(STORAGE_KEYS.epic.accessToken, token)

      window.history.replaceState({}, '', window.location.pathname)
    } else {
      const storedId = getLocalString(STORAGE_KEYS.epic.id)
      const storedName = getLocalString(STORAGE_KEYS.epic.username)
      const storedToken = getSessionString(STORAGE_KEYS.epic.accessToken) || getLocalString(STORAGE_KEYS.epic.accessToken)
      if (storedToken && !getSessionString(STORAGE_KEYS.epic.accessToken)) {
        setSessionString(STORAGE_KEYS.epic.accessToken, storedToken)
      }
      removeLocalString(STORAGE_KEYS.epic.accessToken)
      if (storedId) {
        setEpicId(storedId)
        setUsername(storedName)
        setAccessToken(storedToken)
      }
    }
  }, [])

  const login = () => {
    window.location.href = `${API_BASE}/v1/epic/login`
  }

  const logout = () => {
    setEpicId(null)
    setUsername(null)
    setAccessToken(null)
    removeLocalString(STORAGE_KEYS.epic.id)
    removeLocalString(STORAGE_KEYS.epic.username)
    removeLocalString(STORAGE_KEYS.epic.accessToken)
    removeSessionString(STORAGE_KEYS.epic.accessToken)
  }

  return {
    epicId,
    username,
    accessToken,
    isLoggedIn: !!epicId,
    login,
    logout,
  }
}
