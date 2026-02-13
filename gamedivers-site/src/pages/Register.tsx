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
      setLocalError('Username, email, and password are required')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setLocalError('Please enter a valid email address')
      return
    }

    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters long')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match')
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
      setLocalError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  const displayError = error || localError

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8 bg-void">
      <div className="w-full max-w-md">
        <div className="term-frame">
          <div className="term-panel relative p-8">
            <div className="term-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="term-notch" />

            <div className="relative z-10">
              <h1 className="mb-2 text-4xl font-bold tracking-wide">{t?.('register') || 'CREATE ACCOUNT'}</h1>
              <p className="mb-8 text-xs uppercase tracking-widest term-subtle">Join us and manage your game library</p>

              {displayError && (
                <div className="mb-6 rounded-lg border border-ember/40 bg-black/50 p-4 text-xs text-ember/90">
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="term-label mb-3 block">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="JOHN"
                      className="term-console w-full"
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label htmlFor="lastName" className="term-label mb-3 block">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="DOE"
                      className="term-console w-full"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="username" className="term-label mb-3 block">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="ENTER USERNAME"
                    className="term-console w-full"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="term-label mb-3 block">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="YOUR@EMAIL.COM"
                    className="term-console w-full"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="term-label mb-3 block">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="MIN. 8 CHARACTERS"
                    className="term-console w-full"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="term-label mb-3 block">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="CONFIRM PASSWORD"
                    className="term-console w-full"
                    disabled={isLoading}
                  />
                </div>

                <button type="submit" disabled={isLoading} className="term-btn-primary w-full mt-6">
                  {isLoading ? '... CREATING ACCOUNT ...' : 'CREATE ACCOUNT'}
                </button>
              </form>

              <div className="term-divider my-6" />

              <p className="text-center text-xs uppercase tracking-widest term-subtle">
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

        <div className="mt-8 text-center">
          <p className="text-[10px] uppercase tracking-widest term-subtle">AIO GAME LIBRARY v1.0</p>
        </div>
      </div>
    </div>
  )
}
