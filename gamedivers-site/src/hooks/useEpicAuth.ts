import { useEffect, useState } from 'react'

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
    const params = new URLSearchParams(window.location.search)
    const id = params.get('epicid')
    const name = params.get('username')
    const token = params.get('access_token')

    if (id) {
      setEpicId(id)
      setUsername(name || 'Epic User')
      setAccessToken(token)

      localStorage.setItem('epicId', id)
      if (name) localStorage.setItem('epicUsername', name)
      if (token) localStorage.setItem('epicAccessToken', token)

      window.history.replaceState({}, '', window.location.pathname)
    } else {
      const storedId = localStorage.getItem('epicId')
      const storedName = localStorage.getItem('epicUsername')
      const storedToken = localStorage.getItem('epicAccessToken')
      if (storedId) {
        setEpicId(storedId)
        setUsername(storedName)
        setAccessToken(storedToken)
      }
    }
  }, [])

  const login = () => {
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
    window.location.href = `${API_BASE}/v1/epic/login`
  }

  const logout = () => {
    setEpicId(null)
    setUsername(null)
    setAccessToken(null)
    localStorage.removeItem('epicId')
    localStorage.removeItem('epicUsername')
    localStorage.removeItem('epicAccessToken')
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
