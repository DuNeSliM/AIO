import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/i18n'
import { desktopDownloadUrls } from '../shared/desktopDownload'
import type { Page } from '../types'

const EyeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.269 2.943 9.542 7-1.273 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
)

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.269-2.943-9.542-7a9.975 9.975 0 012.223-3.314M6.61 6.61A9.975 9.975 0 0112 5c4.478 0 8.269 2.943 9.542 7a9.968 9.968 0 01-1.19 2.1"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 15l5.5 5.5M2.5 2.5L8 8"
    />
  </svg>
)

interface LoginPageProps {
  onSuccess: (page: Page) => void
}

export default function Login({ onSuccess }: LoginPageProps) {
  const { login, isLoading, error, clearError } = useAuth()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
                    Username or Email
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
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="ENTER PASSWORD"
                      className="ui-input w-full"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neon/70 hover:text-neon transition-colors"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
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

              <div className="mb-4 flex flex-col items-center gap-2">
                <p className="text-[10px] uppercase tracking-widest ui-subtle">Desktop app</p>
                <a
                  className="ui-btn-secondary w-full text-center"
                  href={desktopDownloadUrls.setupExe}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Download Windows Setup
                </a>
              </div>

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

      </div>
    </div>
  )
}


