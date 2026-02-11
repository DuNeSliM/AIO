import { useEffect, useState } from 'react'
import * as authApi from '../services/api'
import type { User, AuthResponse } from '../types'

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'user'

type AuthState = {
  user: User | null
  isLoggedIn: boolean
  isLoading: boolean
  error: string | null
}

type AuthFunctions = {
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, firstName?: string, lastName?: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export function useAuth(): AuthState & AuthFunctions {
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load user and check tokens on mount
  useEffect(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)

    // If tokens exist, consider user logged in
    if (accessToken && refreshToken) {
      setIsLoggedIn(true)
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch {
          localStorage.removeItem(USER_KEY)
        }
      }
    } else {
      setIsLoggedIn(false)
    }
  }, [])

  const saveTokens = (tokens: AuthResponse) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  }

  const clearTokens = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await authApi.login(username, password)
      saveTokens(response)
      setIsLoggedIn(true)
      
      // Get user info (non-critical - don't fail if this fails)
      try {
        const userInfo = await authApi.getMe(response.accessToken)
        setUser(userInfo)
        localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
      } catch (err) {
        console.warn('Failed to fetch user info:', err)
        // User is still logged in even if we can't fetch their full info
      }
    } catch (err) {
      setIsLoggedIn(false)
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (username: string, email: string, password: string, firstName?: string, lastName?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const newUser = await authApi.register(username, email, password, firstName, lastName)
      setUser(newUser)
      localStorage.setItem(USER_KEY, JSON.stringify(newUser))
      // After registration, user still needs to login
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (refreshToken) {
        await authApi.logout(refreshToken)
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      clearTokens()
      setUser(null)
      setIsLoggedIn(false)
      setIsLoading(false)
    }
  }

  const clearError = () => setError(null)

  return {
    user,
    isLoggedIn,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}
