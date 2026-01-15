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
        className="absolute top-20 left-20 w-72 h-72 bg-secondary-500/20 rounded-full blur-3xl transition-transform duration-300 ease-out"
        style={{ transform: `translate(${mousePosition.x * 30}px, ${mousePosition.y * 30}px)` }}
      ></div>
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl transition-transform duration-300 ease-out"
        style={{ transform: `translate(${mousePosition.x * 50}px, ${mousePosition.y * 50}px)` }}
      ></div>
      <div
        className="absolute top-1/2 left-1/2 w-64 h-64 bg-secondary-400/15 rounded-full blur-3xl transition-transform duration-300 ease-out"
        style={{ transform: `translate(calc(-50% + ${mousePosition.x * 20}px), calc(-50% + ${mousePosition.y * 20}px))` }}
      ></div>

      <div className="glass-modal w-full max-w-md p-8 animate-glass-in">
        {/* Logo und Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 shadow-lg shadow-secondary-500/30 mb-4">
            <span className="text-2xl text-white font-bold">jVC</span>
          </div>
          <h2 className="text-2xl font-bold text-primary-900">
            Willkommen zurück
          </h2>
          <p className="mt-2 text-gray-600">
            jVC Terminverwaltungssystem
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
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
              placeholder="name@beispiel.de"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
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
              className="glass-input-solid w-full"
              placeholder="Dein Passwort"
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
            {loading ? 'Anmeldung läuft...' : 'Anmelden'}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700 transition-colors"
            >
              Passwort vergessen?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
