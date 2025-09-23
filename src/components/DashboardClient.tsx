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
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tabs = [
    { id: 'calendar', name: 'Kalender', available: true },
    { id: 'availability', name: 'Verfügbarkeit', available: true },
    { id: 'profile', name: 'Profil', available: true },
    { id: 'admin', name: 'Verwaltung', available: profile.role === 'admin' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <h1 className="text-xl font-bold text-primary-600">jVC Terminverwaltung</h1>
              </div>
              <div className="ml-6 flex space-x-8">
                {tabs.filter(tab => tab.available).map((tab) => (
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
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {profile.full_name || user.email}
                {profile.role !== 'normal' && (
                  <span className="ml-2 rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700">
                    {profile.role === 'admin' ? 'Administrator' : 'Moderator'}
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
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'calendar' && <CalendarView userRole={profile.role} />}
        {activeTab === 'availability' && <AvailabilityView />}
        {activeTab === 'profile' && <ProfileSettings user={user} profile={profile} />}
        {activeTab === 'admin' && profile.role === 'admin' && <AdminPanel />}
      </main>
    </div>
  )
}