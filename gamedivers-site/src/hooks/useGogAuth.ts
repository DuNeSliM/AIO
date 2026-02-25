import { useEffect, useState } from 'react'
import { API_BASE } from '../services/api'

type GOGAuth = {
  available: boolean
  isLoggedIn: boolean
  login: () => Promise<void>
  logout: () => void
}

export function useGogAuth(): GOGAuth {
  const [available, setAvailable] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Check if GOG Galaxy is available on user's system
  useEffect(() => {
    const checkGOGAvailability = async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/gog/available`)
        if (response.ok) {
          setAvailable(true)
          setIsLoggedIn(true) // If available, user can access local manifest
        } else {
          setAvailable(false)
          setIsLoggedIn(false)
        }
      } catch (err) {
        console.error('GOG availability check failed:', err)
        setAvailable(false)
        setIsLoggedIn(false)
      }
    }

    checkGOGAvailability()
  }, [])

  const login = async () => {
    // No OAuth flow - just check availability
    try {
      const response = await fetch(`${API_BASE}/v1/gog/available`)
      if (response.ok) {
        setAvailable(true)
        setIsLoggedIn(true)
      }
    } catch (err) {
      console.error('GOG check failed:', err)
    }
  }

  const logout = () => {
    setIsLoggedIn(false)
  }

  return {
    available,
    isLoggedIn,
    login,
    logout,
  }
}
