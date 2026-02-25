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
      setLocalError(t('auth.validation.usernamePasswordRequired'))
      return
    }

    try {
      await login(username, password)
      onSuccess('library')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('auth.loginFailed'))
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
              <h1 className="mb-2 text-4xl font-bold tracking-wide">{t('authPages.login.title')}</h1>
              <p className="mb-8 text-xs uppercase tracking-widest ui-subtle">{t('authPages.login.subtitle')}</p>

              {displayError && (
                <div className="mb-6 rounded-lg border border-ember/40 bg-black/50 p-4 text-xs text-ember/90">
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="username" className="ui-label mb-3 block">
                    {t('authPages.fields.username')}
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('authPages.fields.usernamePlaceholder')}
                    className="ui-input w-full"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="ui-label mb-3 block">
                    {t('authPages.fields.password')}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('authPages.fields.passwordPlaceholder')}
                    className="ui-input w-full"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => onSuccess('forgot-password' as Page)}
                    className="mt-2 text-[10px] uppercase tracking-widest text-neon/70 hover:text-neon transition-colors"
                  >
                    {t('authPages.login.forgotPassword')}
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className="ui-btn-primary w-full mt-6">
                  {isLoading ? t('authPages.login.connecting') : t('authPages.login.submit')}
                </button>
              </form>

              <div className="ui-divider my-6" />

              <p className="text-center text-xs uppercase tracking-widest ui-subtle">
                {t('authPages.login.noAccount')}{' '}
                <button
                  type="button"
                  onClick={() => onSuccess('register' as Page)}
                  className="inline font-bold text-neon/90 hover:text-neon transition-colors"
                >
                  {t('authPages.login.createAccount')}
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] uppercase tracking-widest ui-subtle">{t('app.footer')}</p>
        </div>
      </div>
    </div>
  )
}


