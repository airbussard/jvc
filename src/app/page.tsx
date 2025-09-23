export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">jVC Terminverwaltung</h1>
        <p className="text-lg text-gray-600 mb-8">
          Willkommen beim Terminverwaltungssystem des Jugendverbands
        </p>
        <div className="space-y-4">
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Anmelden
          </a>
        </div>
      </div>
    </div>
  )
}