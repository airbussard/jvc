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
          Das Planungstool für den Jugendverband.
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

        {/* Feature highlights */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="card p-6 text-center hover-lift">
            <div className="w-12 h-12 rounded-xl bg-accent-100 text-accent-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">Kalender</h3>
            <p className="text-sm text-neutral-500">Alle Termine übersichtlich verwalten</p>
          </div>

          <div className="card p-6 text-center hover-lift">
            <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">Verfügbarkeit</h3>
            <p className="text-sm text-neutral-500">Urlaube und F-Tage eintragen</p>
          </div>

          <div className="card p-6 text-center hover-lift">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">Export</h3>
            <p className="text-sm text-neutral-500">ICS-Export für alle Kalender-Apps</p>
          </div>
        </div>
      </div>
    </div>
  )
}
