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

      localStorage.setItem('epicId', id)
      if (name) localStorage.setItem('epicUsername', name)
      if (token) sessionStorage.setItem('epicAccessToken', token)

      window.history.replaceState({}, '', window.location.pathname)
    } else {
      const storedId = localStorage.getItem('epicId')
      const storedName = localStorage.getItem('epicUsername')
      const storedToken = sessionStorage.getItem('epicAccessToken') || localStorage.getItem('epicAccessToken')
      if (storedToken && !sessionStorage.getItem('epicAccessToken')) {
        sessionStorage.setItem('epicAccessToken', storedToken)
      }
      localStorage.removeItem('epicAccessToken')
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
    sessionStorage.removeItem('epicAccessToken')
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
