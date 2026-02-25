import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/i18n'
import type { Page } from '../types'

interface RegisterPageProps {
  onSuccess: (page: Page) => void
}

export default function Register({ onSuccess }: RegisterPageProps) {
  const { register, isLoading, error, clearError } = useAuth()
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  })
  const [localError, setLocalError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalError(null)

    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      setLocalError(t('auth.validation.requiredFields'))
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setLocalError(t('auth.validation.invalidEmail'))
      return
    }

    if (formData.password.length < 8) {
      setLocalError(t('auth.validation.passwordTooShort'))
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError(t('auth.validation.passwordMismatch'))
      return
    }

    try {
      await register(
        formData.username,
        formData.email,
        formData.password,
        formData.firstName || undefined,
        formData.lastName || undefined,
      )
      onSuccess('login')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('auth.registrationFailed'))
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
              <h1 className="mb-2 text-4xl font-bold tracking-wide">{t('authPages.register.title')}</h1>
              <p className="mb-8 text-xs uppercase tracking-widest ui-subtle">{t('authPages.register.subtitle')}</p>

              {displayError && (
                <div className="mb-6 rounded-lg border border-ember/40 bg-black/50 p-4 text-xs text-ember/90">
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="ui-label mb-3 block">
                      {t('authPages.fields.firstName')}
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder={t('authPages.fields.firstNamePlaceholder')}
                      className="ui-input w-full"
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label htmlFor="lastName" className="ui-label mb-3 block">
                      {t('authPages.fields.lastName')}
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder={t('authPages.fields.lastNamePlaceholder')}
                      className="ui-input w-full"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="username" className="ui-label mb-3 block">
                    {t('authPages.fields.username')}
                  </label>
                  <input
                    id="username"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder={t('authPages.fields.usernamePlaceholder')}
                    className="ui-input w-full"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="ui-label mb-3 block">
                    {t('authPages.fields.email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t('authPages.fields.emailPlaceholder')}
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
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={t('authPages.fields.passwordMinPlaceholder')}
                    className="ui-input w-full"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="ui-label mb-3 block">
                    {t('authPages.fields.confirmPassword')}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder={t('authPages.fields.confirmPasswordPlaceholder')}
                    className="ui-input w-full"
                    disabled={isLoading}
                  />
                </div>

                <button type="submit" disabled={isLoading} className="ui-btn-primary w-full mt-6">
                  {isLoading ? t('authPages.register.creating') : t('authPages.register.submit')}
                </button>
              </form>

              <div className="ui-divider my-6" />

              <p className="text-center text-xs uppercase tracking-widest ui-subtle">
                {t('authPages.register.hasAccount')}{' '}
                <button
                  type="button"
                  onClick={() => onSuccess('login' as Page)}
                  className="inline font-bold text-neon/90 hover:text-neon transition-colors"
                >
                  {t('authPages.register.loginNow')}
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
