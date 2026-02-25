import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/i18n'
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
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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
      )
      onSuccess('login')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed')
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
              <h1 className="mb-2 text-4xl font-bold tracking-wide">{t?.('register') || 'CREATE ACCOUNT'}</h1>
              <p className="mb-8 text-xs uppercase tracking-widest ui-subtle">Join us and manage your game library</p>

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
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="ENTER USERNAME"
                    className="ui-input w-full"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="ui-label mb-3 block">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="YOUR@EMAIL.COM"
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
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="MIN. 8 CHARACTERS"
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
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="ui-label mb-3 block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="CONFIRM PASSWORD"
                      className="ui-input w-full"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((s) => !s)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neon/70 hover:text-neon transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOffIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="ui-btn-primary w-full mt-6">
                  {isLoading ? '... CREATING ACCOUNT ...' : 'CREATE ACCOUNT'}
                </button>
              </form>

              <div className="ui-divider my-6" />

              <p className="text-center text-xs uppercase tracking-widest ui-subtle">
                Already have credentials?{' '}
                <button
                  type="button"
                  onClick={() => onSuccess('login' as Page)}
                  className="inline font-bold text-neon/90 hover:text-neon transition-colors"
                >
                  LOGIN NOW
                </button>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
