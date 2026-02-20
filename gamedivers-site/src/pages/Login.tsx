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
    <div className="flex items-center justify-center min-h-screen px-4 py-8 bg-void">
      <div className="w-full max-w-md">
        <div className="ui-surface">
          <div className="ui-panel relative p-8">
            <div className="ui-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="ui-notch" />

            <div className="relative z-10">
              <h1 className="mb-2 text-4xl font-bold tracking-wide">{t?.('login') || 'LOGIN'}</h1>
              <p className="mb-8 text-xs uppercase tracking-widest ui-subtle">Access your game library</p>

              {displayError && (
                <div className="mb-6 rounded-lg border border-ember/40 bg-black/50 p-4 text-xs text-ember/90">
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="username" className="ui-label mb-3 block">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ENTER USERNAME"
                    className="ui-input w-full"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="ui-label mb-3 block">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ENTER PASSWORD"
                    className="ui-input w-full"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => onSuccess('forgot-password' as Page)}
                    className="mt-2 text-[10px] uppercase tracking-widest text-neon/70 hover:text-neon transition-colors"
                  >
                    FORGOT PASSWORD?
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className="ui-btn-primary w-full mt-6">
                  {isLoading ? '... CONNECTING ...' : 'LOGIN'}
                </button>
              </form>

              <div className="ui-divider my-6" />

              <p className="text-center text-xs uppercase tracking-widest ui-subtle">
                No credentials yet?{' '}
                <button
                  type="button"
                  onClick={() => onSuccess('register' as Page)}
                  className="inline font-bold text-neon/90 hover:text-neon transition-colors"
                >
                  CREATE ACCOUNT
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] uppercase tracking-widest ui-subtle">AIO GAME LIBRARY v1.0</p>
        </div>
      </div>
    </div>
  )
}


