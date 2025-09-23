'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

type Profile = Database['public']['Tables']['profiles']['Row']
type Vacation = Database['public']['Tables']['vacations']['Row']
type UnavailableDay = Database['public']['Tables']['unavailable_days']['Row']

interface ProfileSettingsProps {
  user: User
  profile: Profile
}

export default function ProfileSettings({ user, profile }: ProfileSettingsProps) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [unavailableDays, setUnavailableDays] = useState<UnavailableDay[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newVacationStart, setNewVacationStart] = useState('')
  const [newVacationEnd, setNewVacationEnd] = useState('')
  const [newVacationNote, setNewVacationNote] = useState('')

  const [newUnavailableDate, setNewUnavailableDate] = useState('')
  const [newUnavailableReason, setNewUnavailableReason] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadVacations()
    loadUnavailableDays()
  }, [])

  const loadVacations = async () => {
    const { data } = await supabase
      .from('vacations')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })

    if (data) setVacations(data)
  }

  const loadUnavailableDays = async () => {
    const { data } = await supabase
      .from('unavailable_days')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (data) setUnavailableDays(data)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setMessage(null)

    const { error } = await (supabase as any)
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id)

    if (!error) {
      setMessage({ type: 'success', text: 'Profil erfolgreich aktualisiert!' })
    } else {
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren des Profils' })
    }
    setSaving(false)
  }

  const handleAddVacation = async () => {
    if (!newVacationStart || !newVacationEnd) return

    const { error } = await (supabase as any)
      .from('vacations')
      .insert({
        user_id: user.id,
        start_date: newVacationStart,
        end_date: newVacationEnd,
        note: newVacationNote || null,
      })
      .select()
      .single()

    if (!error) {
      await loadVacations()
      setNewVacationStart('')
      setNewVacationEnd('')
      setNewVacationNote('')
      setMessage({ type: 'success', text: 'Urlaub erfolgreich hinzugefügt!' })
    } else {
      console.error('Error adding vacation:', error)
      setMessage({ type: 'error', text: `Fehler beim Hinzufügen des Urlaubs: ${error.message}` })
    }
  }

  const handleDeleteVacation = async (id: string) => {
    const { error } = await (supabase as any)
      .from('vacations')
      .delete()
      .eq('id', id)

    if (!error) {
      await loadVacations()
      setMessage({ type: 'success', text: 'Urlaub erfolgreich gelöscht!' })
    } else {
      setMessage({ type: 'error', text: `Fehler beim Löschen: ${error.message}` })
    }
  }

  const handleAddUnavailableDay = async () => {
    if (!newUnavailableDate) return

    const { error } = await (supabase as any)
      .from('unavailable_days')
      .insert({
        user_id: user.id,
        date: newUnavailableDate,
        reason: newUnavailableReason || null,
      })
      .select()
      .single()

    if (!error) {
      await loadUnavailableDays()
      setNewUnavailableDate('')
      setNewUnavailableReason('')
      setMessage({ type: 'success', text: 'F-Tag erfolgreich hinzugefügt!' })
    } else {
      console.error('Error adding F-day:', error)
      setMessage({ type: 'error', text: `Fehler beim Hinzufügen des F-Tags: ${error.message}` })
    }
  }

  const handleDeleteUnavailableDay = async (id: string) => {
    const { error } = await (supabase as any)
      .from('unavailable_days')
      .delete()
      .eq('id', id)

    if (!error) {
      await loadUnavailableDays()
      setMessage({ type: 'success', text: 'F-Tag erfolgreich gelöscht!' })
    } else {
      setMessage({ type: 'error', text: `Fehler beim Löschen: ${error.message}` })
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-md p-4 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Persönliche Daten
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">E-Mail</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-700 w-full sm:w-auto"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Urlaubszeiträume
          </h3>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="date"
              value={newVacationStart}
              onChange={(e) => setNewVacationStart(e.target.value)}
              placeholder="Von"
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm w-full"
            />
            <input
              type="date"
              value={newVacationEnd}
              onChange={(e) => setNewVacationEnd(e.target.value)}
              placeholder="Bis"
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm w-full"
            />
            <input
              type="text"
              value={newVacationNote}
              onChange={(e) => setNewVacationNote(e.target.value)}
              placeholder="Notiz (optional)"
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm w-full"
            />
            <button
              onClick={handleAddVacation}
              className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-700 w-full sm:w-auto"
            >
              Hinzufügen
            </button>
          </div>

          <div className="space-y-2">
            {vacations.map((vacation) => (
              <div key={vacation.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-md space-y-2 sm:space-y-0">
                <div>
                  <span className="font-medium">
                    {format(new Date(vacation.start_date), 'dd.MM.yyyy', { locale: de })} -
                    {format(new Date(vacation.end_date), 'dd.MM.yyyy', { locale: de })}
                  </span>
                  {vacation.note && <span className="ml-2 text-sm text-gray-600">({vacation.note})</span>}
                </div>
                <button
                  onClick={() => handleDeleteVacation(vacation.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Löschen
                </button>
              </div>
            ))}
            {vacations.length === 0 && (
              <p className="text-gray-500 text-sm">Keine Urlaubszeiträume eingetragen</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            F-Tage (Nicht verfügbar)
          </h3>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input
              type="date"
              value={newUnavailableDate}
              onChange={(e) => setNewUnavailableDate(e.target.value)}
              placeholder="Datum"
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm w-full"
            />
            <input
              type="text"
              value={newUnavailableReason}
              onChange={(e) => setNewUnavailableReason(e.target.value)}
              placeholder="Grund (optional)"
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm w-full"
            />
            <button
              onClick={handleAddUnavailableDay}
              className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-700 w-full sm:w-auto"
            >
              Hinzufügen
            </button>
          </div>

          <div className="space-y-2">
            {unavailableDays.map((day) => (
              <div key={day.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-md space-y-2 sm:space-y-0">
                <div>
                  <span className="font-medium">
                    {format(new Date(day.date), 'dd.MM.yyyy', { locale: de })}
                  </span>
                  {day.reason && <span className="ml-2 text-sm text-gray-600">({day.reason})</span>}
                </div>
                <button
                  onClick={() => handleDeleteUnavailableDay(day.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Löschen
                </button>
              </div>
            ))}
            {unavailableDays.length === 0 && (
              <p className="text-gray-500 text-sm">Keine F-Tage eingetragen</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}