'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import CalendarView from '@/components/CalendarView'
import AvailabilityView from '@/components/AvailabilityView'
import AdminPanel from '@/components/AdminPanel'
import ProfileSettings from '@/components/ProfileSettings'

type Profile = Database['public']['Tables']['profiles']['Row']

interface DashboardClientProps {
  user: User
  profile: Profile
}

export default function DashboardClient({ user, profile }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState('calendar')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tabs = [
    { id: 'calendar', name: 'Kalender', icon: '📅', available: true },
    { id: 'availability', name: 'Verfügbarkeit', icon: '👥', available: true },
    { id: 'profile', name: 'Profil', icon: '👤', available: true },
    { id: 'admin', name: 'Verwaltung', icon: '⚙️', available: profile.role === 'admin' },
  ]

  const availableTabs = tabs.filter(tab => tab.available)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/30 to-secondary-50/20">
      {/* Navigation */}
      <nav className="glass-nav-solid sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">jV</span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-white">
                    <span className="hidden sm:inline">Terminverwaltung</span>
                    <span className="sm:hidden">jVC</span>
                  </h1>
                </div>
              </div>
              {/* Desktop tabs */}
              <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
                {availableTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`glass-tab ${
                      activeTab === tab.id ? 'glass-tab-active' : ''
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>

            {/* Desktop user info */}
            <div className="hidden sm:flex sm:items-center sm:space-x-4">
              <span className="text-sm text-white/90 flex items-center">
                <span className="hidden lg:inline">{profile.full_name || user.email}</span>
                <span className="lg:hidden">{profile.full_name?.split(' ')[0] || user.email?.split('@')[0]}</span>
                {profile.role !== 'normal' && (
                  <span className="ml-2 glass-badge glass-badge-success">
                    {profile.role === 'admin' ? 'Admin' : 'Mod'}
                  </span>
                )}
              </span>
              <button
                onClick={handleLogout}
                className="glass-button-ghost text-sm px-4 py-2"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-primary-800/95 backdrop-blur-xl border-t border-white/10">
            <div className="pt-2 pb-3 space-y-1 px-4">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`block w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="mr-3">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>
            <div className="pt-3 pb-4 border-t border-white/10 px-4">
              <div className="space-y-3">
                <div className="text-white/90">
                  <div className="font-medium">{profile.full_name || 'Unbekannt'}</div>
                  <div className="text-sm text-white/60">{user.email}</div>
                  {profile.role !== 'normal' && (
                    <span className="inline-block mt-2 glass-badge glass-badge-success">
                      {profile.role === 'admin' ? 'Administrator' : 'Moderator'}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full glass-button-ghost text-sm py-2"
                >
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        {activeTab === 'calendar' && <CalendarView userRole={profile.role} />}
        {activeTab === 'availability' && <AvailabilityView />}
        {activeTab === 'profile' && <ProfileSettings user={user} profile={profile} />}
        {activeTab === 'admin' && profile.role === 'admin' && <AdminPanel />}
      </main>
    </div>
  )
}
