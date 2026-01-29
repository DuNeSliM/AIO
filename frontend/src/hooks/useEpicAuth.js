import { useState, useEffect } from 'react'

export function useEpicAuth() {
  const [epicId, setEpicId] = useState(null)
  const [username, setUsername] = useState(null)
  const [accessToken, setAccessToken] = useState(null)

  useEffect(() => {
    // Check URL params for Epic Games login callback
    const params = new URLSearchParams(window.location.search)
    const id = params.get('epicid')
    const name = params.get('username')
    const token = params.get('access_token')
    
    if (id) {
      setEpicId(id)
      setUsername(name || 'Epic User')
      setAccessToken(token)
      
      // Store in localStorage
      localStorage.setItem('epicId', id)
      if (name) localStorage.setItem('epicUsername', name)
      if (token) localStorage.setItem('epicAccessToken', token)
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      // Load from localStorage
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
    logout 
  }
}
