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
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Navigation */}
      <nav className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <h1 className="text-lg sm:text-xl font-bold text-primary-600">
                  <span className="hidden sm:inline">jVC Terminverwaltung</span>
                  <span className="sm:hidden">jVC</span>
                </h1>
              </div>
              {/* Desktop tabs */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {availableTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
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
              <span className="text-sm text-gray-700">
                <span className="hidden lg:inline">{profile.full_name || user.email}</span>
                <span className="lg:hidden">{profile.full_name?.split(' ')[0] || user.email?.split('@')[0]}</span>
                {profile.role !== 'normal' && (
                  <span className="ml-2 rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700">
                    {profile.role === 'admin' ? 'Admin' : 'Mod'}
                  </span>
                )}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200">
            <div className="pt-2 pb-3 space-y-1">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`block w-full text-left px-4 py-2 text-base font-medium ${
                    activeTab === tab.id
                      ? 'bg-primary-50 border-l-4 border-primary-500 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>
            <div className="pt-3 pb-3 border-t border-gray-200">
              <div className="px-4 space-y-2">
                <div className="text-sm text-gray-700">
                  <div className="font-medium">{profile.full_name || 'Unbekannt'}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                  {profile.role !== 'normal' && (
                    <span className="inline-block mt-1 rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700">
                      {profile.role === 'admin' ? 'Administrator' : 'Moderator'}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-md bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:py-8 sm:px-6 lg:px-8">
        {activeTab === 'calendar' && <CalendarView userRole={profile.role} />}
        {activeTab === 'availability' && <AvailabilityView />}
        {activeTab === 'profile' && <ProfileSettings user={user} profile={profile} />}
        {activeTab === 'admin' && profile.role === 'admin' && <AdminPanel />}
      </main>
    </div>
  )
}