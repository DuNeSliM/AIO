import { useState } from 'react'
import { requestPasswordReset } from '../services/api'
import { useI18n } from '../i18n/i18n'
import type { Page } from '../types'

interface ForgotPasswordPageProps {
  onSuccess: (page: Page) => void
}

export default function ForgotPassword({ onSuccess }: ForgotPasswordPageProps) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError(t('auth.validation.emailRequired'))
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError(t('auth.validation.invalidEmail'))
      return
    }

    try {
      setIsLoading(true)
      await requestPasswordReset(email)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process request')
    } finally {
      setIsLoading(false)
    }
  }

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
              <h1 className="mb-2 text-4xl font-bold tracking-wide">
                RESET PASSWORD
              </h1>
              <p className="mb-8 text-xs uppercase tracking-widest term-subtle">
                Enter your email to receive recovery instructions
              </p>

              {error && (
                <div className="mb-6 rounded-lg border border-ember/40 bg-black/50 p-4 text-xs text-ember/90">
                  {error}
                </div>
              )}

              {submitted ? (
                <div className="rounded-lg border border-neon/40 bg-black/50 p-6 text-center">
                  <div className="mb-4 text-lg text-neon">✓ SUCCESS</div>
                  <p className="mb-6 text-xs uppercase tracking-widest term-subtle">
                    Check your email for password reset instructions
                  </p>
                  <button
                    type="button"
                    onClick={() => onSuccess('login' as Page)}
                    className="term-btn-primary w-full"
                  >
                    RETURN TO LOGIN
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="term-label mb-3 block">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="YOUR@EMAIL.COM"
                      className="term-console w-full"
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="term-btn-primary w-full mt-6"
                  >
                    {isLoading ? '... SENDING ...' : 'SEND RESET LINK'}
                  </button>
                </form>
              )}

              <div className="term-divider my-6" />

              <p className="text-center text-xs uppercase tracking-widest term-subtle">
                Remember password?{' '}
                <button
                  type="button"
                  onClick={() => onSuccess('login' as Page)}
                  className="inline font-bold text-neon/90 hover:text-neon transition-colors"
                >
                  LOGIN
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] uppercase tracking-widest term-subtle">
            AIO GAME LIBRARY v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
