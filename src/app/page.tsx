export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-main-gradient p-8 relative overflow-hidden">
      {/* Dekorative Blur-Kreise */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-secondary-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-400/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-secondary-400/20 rounded-full blur-3xl"></div>

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

      {/* Footer */}
      <div className="absolute bottom-8 text-center">
        <p className="text-white/40 text-sm">
          Jugendverband Terminverwaltung
        </p>
      </div>
    </div>
  )
}
