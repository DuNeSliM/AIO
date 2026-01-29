import React, { useState, useEffect } from 'react'

export function useSteamAuth() {
  const [steamId, setSteamId] = useState(null)
  const [username, setUsername] = useState(null)

  useEffect(() => {
    // Check URL params for Steam login callback
    const params = new URLSearchParams(window.location.search)
    const id = params.get('steamid')
    const name = params.get('username')
    
    if (id) {
      setSteamId(id)
      setUsername(name || 'Steam User')
      
      // Store in localStorage
      localStorage.setItem('steamId', id)
      if (name) localStorage.setItem('steamUsername', name)
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      // Load from localStorage
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
