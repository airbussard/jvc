'use client'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-cool flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Decorative background shapes - Lime accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-200/40 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary-200/30 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-accent-100/30 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="text-center relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-900 mb-8 hover-lift shadow-lg p-3">
          <img src="/vc-logo.svg" alt="VC Logo" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-neutral-900 mb-4">
          Terminverwaltung
        </h1>
        <p className="text-lg sm:text-xl text-neutral-600 mb-10 max-w-lg mx-auto">
          Das Planungstool für die jVC.
          <br className="hidden sm:block" />
          Termine, Urlaube und Verfügbarkeiten auf einen Blick.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/login"
            className="btn-primary text-lg px-8 py-4 inline-flex items-center justify-center gap-3"
          >
            Anmelden
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
