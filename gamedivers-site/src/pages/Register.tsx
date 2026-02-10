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

    // Validate required fields
    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      setLocalError('Username, email, and password are required')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setLocalError('Please enter a valid email address')
      return
    }

    // Validate password length
    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters long')
      return
    }

    // Check password confirmation
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
        formData.lastName || undefined
      )
      onSuccess('library')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  const displayError = error || localError

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface-secondary p-8">
          <h1 className="mb-2 text-3xl font-bold text-text-primary">
            {t?.('register.title') || 'Create Account'}
          </h1>
          <p className="mb-8 text-text-secondary">
            Join us and manage your game library
          </p>

          {displayError && (
            <div className="mb-6 rounded-lg bg-red-500/10 p-4 text-sm text-red-400">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-text-primary mb-2">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  className="w-full rounded-lg border border-border bg-surface-primary px-4 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-text-primary mb-2">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className="w-full rounded-lg border border-border bg-surface-primary px-4 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose your username"
                className="w-full rounded-lg border border-border bg-surface-primary px-4 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
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
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                className="w-full rounded-lg border border-border bg-surface-primary px-4 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                className="w-full rounded-lg border border-border bg-surface-primary px-4 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-text-primary hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-text-secondary text-sm">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onSuccess('login' as Page)}
              className="font-medium text-accent hover:text-accent/80 transition-colors"
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
