'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const router = useRouter()
  const supabase = createClient()

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e
    const x = (clientX / window.innerWidth - 0.5) * 2
    const y = (clientY / window.innerHeight - 0.5) * 2
    setMousePosition({ x, y })
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-main-gradient px-4 py-8 relative overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Dekorative Blur-Kreise mit Parallax-Effekt */}
      <div
        className="absolute top-20 left-20 w-72 h-72 bg-accent-500/30 rounded-full blur-3xl transition-transform duration-300 ease-out"
        style={{ transform: `translate(${mousePosition.x * 30}px, ${mousePosition.y * 30}px)` }}
      ></div>
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-primary-400/25 rounded-full blur-3xl transition-transform duration-300 ease-out"
        style={{ transform: `translate(${mousePosition.x * 50}px, ${mousePosition.y * 50}px)` }}
      ></div>
      <div
        className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent-400/20 rounded-full blur-3xl transition-transform duration-300 ease-out"
        style={{ transform: `translate(calc(-50% + ${mousePosition.x * 20}px), calc(-50% + ${mousePosition.y * 20}px))` }}
      ></div>

      <div className="card w-full max-w-md p-8 animate-scale-in relative">
        {/* Logo und Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 shadow-lg shadow-secondary-500/30 mb-4 hover-lift">
            <span className="text-2xl text-white font-bold">jVC</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Willkommen zurück
          </h1>
          <p className="mt-2 text-neutral-500">
            jVC Terminverwaltungssystem
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
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
              className="input"
              placeholder="name@beispiel.de"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Dein Passwort"
            />
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 animate-slide-up">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
            aria-label="Anmelden"
            aria-busy={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Anmeldung läuft...
              </span>
            ) : (
              'Anmelden'
            )}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700 transition-colors font-medium"
            >
              Passwort vergessen?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
