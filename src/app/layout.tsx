import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
})

export const metadata: Metadata = {
  title: 'jVC - Terminverwaltung',
  description: 'Terminverwaltung und Verfügbarkeitsplanung',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={`${outfit.className} min-h-screen antialiased`}>{children}</body>
    </html>
  )
}