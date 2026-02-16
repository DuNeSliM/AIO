import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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
  validateTokens: () => Promise<void>
}

type AuthContextType = AuthState & AuthFunctions

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Validate tokens on app startup
  useEffect(() => {
    const validateOnMount = async () => {
      try {
        setIsLoading(true)
        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

        // If no tokens, user is not logged in
        if (!accessToken || !refreshToken) {
          setIsLoggedIn(false)
          setUser(null)
          setIsInitialized(true)
          return
        }

        // Validate tokens with backend
        try {
          const validatedUser = await authApi.getMe(accessToken)
          setUser(validatedUser)
          setIsLoggedIn(true)
          localStorage.setItem(USER_KEY, JSON.stringify(validatedUser))
        } catch (err) {
          // Token validation failed - clear everything
          console.warn('Token validation failed:', err)
          clearTokens()
          setIsLoggedIn(false)
          setUser(null)
          setError('Session expired. Please login again.')
        }
      } finally {
        setIsLoading(false)
        setIsInitialized(true)
      }
    }

    validateOnMount()
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

  const validateTokens = async () => {
    try {
      setIsLoading(true)
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
      
      if (!accessToken) {
        setIsLoggedIn(false)
        setUser(null)
        return
      }

      const validatedUser = await authApi.getMe(accessToken)
      setUser(validatedUser)
      setIsLoggedIn(true)
      localStorage.setItem(USER_KEY, JSON.stringify(validatedUser))
    } catch (err) {
      console.warn('Token validation failed:', err)
      clearTokens()
      setIsLoggedIn(false)
      setUser(null)
      setError('Session expired. Please login again.')
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await authApi.login(username, password)
      saveTokens(response)
      setIsLoggedIn(true)

      // Fetch user info
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

  const register = async (
    username: string,
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => {
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
      setError(null)
    }
  }

  const clearError = () => setError(null)

  const value: AuthContextType = {
    user,
    isLoggedIn,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
    validateTokens,
  }

  // Don't show app content until auth initialization is complete
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-void">
        <div className="text-center">
          <p className="text-sm text-term-subtle">Initializing...</p>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Export token getters for API interceptor
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}
