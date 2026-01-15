'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import CalendarView from '@/components/CalendarView'
import AvailabilityView from '@/components/AvailabilityView'
import ExemptionsView from '@/components/ExemptionsView'
import AdminPanel from '@/components/AdminPanel'
import ProfileSettings from '@/components/ProfileSettings'

type Profile = Database['public']['Tables']['profiles']['Row']

interface DashboardClientProps {
  user: User
  profile: Profile
}

// SVG Icons
const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const DocumentIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
)

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
    { id: 'calendar', name: 'Kalender', icon: CalendarIcon, available: true },
    { id: 'availability', name: 'Verfügbarkeit', icon: UsersIcon, available: true },
    { id: 'exemptions', name: 'Freistellungen', icon: DocumentIcon, available: true },
    { id: 'profile', name: 'Profil', icon: UserIcon, available: true },
    { id: 'admin', name: 'Verwaltung', icon: SettingsIcon, available: profile.role === 'admin' },
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
                    <span className="text-white font-bold text-xs">jVC</span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-white">
                    <span className="hidden sm:inline">Terminverwaltung</span>
                    <span className="sm:hidden">jVC</span>
                  </h1>
                </div>
              </div>
              {/* Desktop tabs */}
              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                {availableTabs.map((tab) => {
                  const IconComponent = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`glass-tab ${
                        activeTab === tab.id ? 'glass-tab-active' : ''
                      }`}
                    >
                      <IconComponent />
                      <span className="ml-2">{tab.name}</span>
                    </button>
                  )
                })}
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
              {availableTabs.map((tab) => {
                const IconComponent = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setMobileMenuOpen(false)
                    }}
                    className={`flex items-center w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <IconComponent />
                    <span className="ml-3">{tab.name}</span>
                  </button>
                )
              })}
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
        {activeTab === 'exemptions' && <ExemptionsView />}
        {activeTab === 'profile' && <ProfileSettings user={user} profile={profile} />}
        {activeTab === 'admin' && profile.role === 'admin' && <AdminPanel />}
      </main>
    </div>
  )
}
