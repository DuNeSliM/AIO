import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../services/api'
import { clearPersistedAuthTokens } from '../services/api'
import type { AuthResponse, User } from '../types'

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

type AuthContextValue = AuthState & AuthFunctions

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

function readStoredUser(): User | null {
  const storedUser = localStorage.getItem(USER_KEY)
  if (!storedUser) return null

  try {
    return JSON.parse(storedUser) as User
  } catch {
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(USER_KEY)
    return null
  }
}

export function getAccessToken(): string | null {
  const localToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (localToken) return localToken
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  const localToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (localToken) return localToken
  return sessionStorage.getItem(REFRESH_TOKEN_KEY)
}

function hasStoredTokens(): boolean {
  return !!getAccessToken() && !!getRefreshToken()
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const saveTokens = (tokens: AuthResponse) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  }

  const clearTokens = () => {
    clearPersistedAuthTokens()
  }

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      setIsLoading(true)
      setError(null)

      const accessToken = getAccessToken()
      const refreshToken = getRefreshToken()

      if (!accessToken || !refreshToken) {
        if (!cancelled) {
          clearTokens()
          setUser(null)
          setIsLoggedIn(false)
          setIsLoading(false)
        }
        return
      }

      try {
        const currentUser = await authApi.getMe(accessToken)
        if (cancelled) return
        setUser(currentUser)
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
        setIsLoggedIn(true)
      } catch {
        try {
          const refreshed = await authApi.refreshToken(refreshToken)
          if (cancelled) return
          saveTokens(refreshed)

          const currentUser = await authApi.getMe(refreshed.accessToken)
          if (cancelled) return
          setUser(currentUser)
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
          setIsLoggedIn(true)
        } catch {
          if (cancelled) return
          clearTokens()
          setUser(null)
          setIsLoggedIn(false)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== ACCESS_TOKEN_KEY &&
        event.key !== REFRESH_TOKEN_KEY &&
        event.key !== USER_KEY
      ) {
        return
      }

      const loggedIn = hasStoredTokens()
      setIsLoggedIn(loggedIn)
      if (!loggedIn) {
        setUser(null)
        setError(null)
      } else {
        const storedUser = readStoredUser()
        if (storedUser) {
          setUser(storedUser)
        }
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await authApi.login(username, password)
      saveTokens(response)

      try {
        const userInfo = await authApi.getMe(response.accessToken)
        setUser(userInfo)
        localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
      } catch {
        const fallbackUser = readStoredUser()
        setUser(fallbackUser)
      }

      setIsLoggedIn(true)
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
      await authApi.register(username, email, password, firstName, lastName)
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
      const refreshToken = getRefreshToken()
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoggedIn,
      isLoading,
      error,
      login,
      register,
      logout,
      clearError,
    }),
    [user, isLoggedIn, isLoading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
