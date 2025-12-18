'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-main-gradient px-4 relative overflow-hidden">
        {/* Dekorative Blur-Kreise */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-secondary-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl"></div>

        <div className="glass-modal w-full max-w-md p-8 animate-glass-in">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 shadow-lg mb-6">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-primary-900">
              E-Mail versendet
            </h2>
            <p className="mt-3 text-gray-600">
              Wir haben dir eine E-Mail mit einem Link zum Zurücksetzen deines Passworts gesendet.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Die E-Mail wurde an <strong className="text-primary-700">{email}</strong> gesendet
            </p>
            <div className="mt-8 space-y-3">
              <Link
                href="/login"
                className="glass-button-primary block w-full text-center"
              >
                Zurück zur Anmeldung
              </Link>
              <button
                onClick={() => setSuccess(false)}
                className="block w-full text-sm text-primary-600 hover:text-primary-700 transition-colors"
              >
                E-Mail erneut senden
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-main-gradient px-4 py-8 relative overflow-hidden">
      {/* Dekorative Blur-Kreise */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-secondary-500/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl"></div>

      <div className="glass-modal w-full max-w-md p-8 animate-glass-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg mb-4">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-primary-900">
            Passwort zurücksetzen
          </h2>
          <p className="mt-2 text-gray-600">
            Gib deine E-Mail-Adresse ein und wir senden dir einen Link.
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              E-Mail-Adresse
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input-solid w-full"
              placeholder="deine-email@beispiel.de"
            />
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glass-button-primary w-full"
          >
            {loading ? 'Sende E-Mail...' : 'Link zum Zurücksetzen senden'}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-700 transition-colors"
            >
              Zurück zur Anmeldung
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
