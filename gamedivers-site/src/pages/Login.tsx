import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/i18n'
import type { Page } from '../types'

interface LoginPageProps {
  onSuccess: (page: Page) => void
}

export default function Login({ onSuccess }: LoginPageProps) {
  const { login, isLoading, error, clearError } = useAuth()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalError(null)

    if (!username.trim() || !password.trim()) {
      setLocalError('Username and password are required')
      return
    }

    try {
      await login(username, password)
      onSuccess('library')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  const displayError = error || localError

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface-secondary p-8">
          <h1 className="mb-2 text-3xl font-bold text-text-primary">
            {t?.('login.title') || 'Login'}
          </h1>
          <p className="mb-8 text-text-secondary">
            Access your game library
          </p>

          {displayError && (
            <div className="mb-6 rounded-lg bg-red-500/10 p-4 text-sm text-red-400">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full rounded-lg border border-border bg-surface-primary px-4 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-border bg-surface-primary px-4 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-text-primary hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-center text-text-secondary text-sm">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => onSuccess('register' as Page)}
              className="font-medium text-accent hover:text-accent/80 transition-colors"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
