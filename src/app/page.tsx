'use client'

import { useState } from 'react'

export default function HomePage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e
    const x = (clientX / window.innerWidth - 0.5) * 2
    const y = (clientY / window.innerHeight - 0.5) * 2
    setMousePosition({ x, y })
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-main-gradient p-8 relative overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Dekorative Blur-Kreise mit Parallax-Effekt */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-secondary-500/20 rounded-full blur-3xl animate-pulse transition-transform duration-300 ease-out"
        style={{ transform: `translate(${mousePosition.x * 80}px, ${mousePosition.y * 80}px)` }}
      ></div>
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-400/30 rounded-full blur-3xl animate-pulse transition-transform duration-300 ease-out"
        style={{ transform: `translate(${mousePosition.x * 120}px, ${mousePosition.y * 120}px)` }}
      ></div>
      <div
        className="absolute top-1/2 right-1/3 w-64 h-64 bg-secondary-400/20 rounded-full blur-3xl transition-transform duration-300 ease-out"
        style={{ transform: `translate(${mousePosition.x * 60}px, ${mousePosition.y * 60}px)` }}
      ></div>

      <div className="text-center relative z-10">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-secondary-400 to-secondary-600 shadow-2xl shadow-secondary-500/30 mb-8">
          <span className="text-4xl text-white font-bold">jVC</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 drop-shadow-lg">
          jVC Terminverwaltung
        </h1>
        <p className="text-lg sm:text-xl text-white/80 mb-12 max-w-md mx-auto">
          Willkommen beim Terminverwaltungssystem des Jugendverbands
        </p>

        <a
          href="/login"
          className="glass-button-secondary inline-flex items-center text-lg px-8 py-4 shadow-lg shadow-secondary-500/20 hover:shadow-xl hover:shadow-secondary-500/30 transition-all duration-300"
        >
          Jetzt anmelden
          <svg className="ml-3 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

    </div>
  )
}
