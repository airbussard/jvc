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
      setMessage({ type: 'error', text: `Fehler beim Hinzufügen des Urlaubs: ${error.message}` })
    }
  }

  const handleDeleteVacation = async (id: string) => {
    if (!window.confirm('Möchtest du diesen Urlaubszeitraum wirklich löschen?')) {
      return
    }

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
      setMessage({ type: 'error', text: `Fehler beim Hinzufügen des F-Tags: ${error.message}` })
    }
  }

  const handleDeleteUnavailableDay = async (id: string) => {
    if (!window.confirm('Möchtest du diesen F-Tag wirklich löschen?')) {
      return
    }

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
        <div className={`p-4 rounded-xl ${
          message.type === 'success'
            ? 'bg-accent-50 border border-accent-200 text-accent-800'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Personal Data */}
      <div className="glass-card-solid overflow-hidden">
        <div className="section-header">
          <h3 className="text-lg font-semibold text-primary-900">
            Persönliche Daten
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="glass-input-solid w-full"
                placeholder="Dein vollständiger Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">E-Mail</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="glass-input-solid w-full bg-gray-50 cursor-not-allowed"
              />
            </div>
          </div>
          <div className="mt-5">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="glass-button-primary w-full sm:w-auto"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Vacations */}
      <div className="glass-card-solid overflow-hidden">
        <div className="section-header">
          <h3 className="text-lg font-semibold text-primary-900">
            Urlaubszeiträume
          </h3>
        </div>
        <div className="p-6">
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="date"
              value={newVacationStart}
              onChange={(e) => setNewVacationStart(e.target.value)}
              className="glass-input-solid"
            />
            <input
              type="date"
              value={newVacationEnd}
              onChange={(e) => setNewVacationEnd(e.target.value)}
              className="glass-input-solid"
            />
            <input
              type="text"
              value={newVacationNote}
              onChange={(e) => setNewVacationNote(e.target.value)}
              placeholder="Notiz (optional)"
              className="glass-input-solid"
            />
            <button
              onClick={handleAddVacation}
              className="glass-button-secondary text-sm px-4 py-3"
            >
              Hinzufügen
            </button>
          </div>

          <div className="space-y-3">
            {vacations.map((vacation) => (
              <div key={vacation.id} className="glass-list-item">
                <div>
                  <span className="font-medium text-gray-900">
                    {format(new Date(vacation.start_date), 'dd.MM.yyyy', { locale: de })} -
                    {format(new Date(vacation.end_date), 'dd.MM.yyyy', { locale: de })}
                  </span>
                  {vacation.note && <span className="ml-2 text-sm text-gray-500">({vacation.note})</span>}
                </div>
                <button
                  onClick={() => handleDeleteVacation(vacation.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                >
                  Löschen
                </button>
              </div>
            ))}
            {vacations.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">Keine Urlaubszeiträume eingetragen</p>
            )}
          </div>
        </div>
      </div>

      {/* Unavailable Days */}
      <div className="glass-card-solid overflow-hidden">
        <div className="section-header">
          <h3 className="text-lg font-semibold text-primary-900">
            F-Tage (Nicht verfügbar)
          </h3>
        </div>
        <div className="p-6">
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              type="date"
              value={newUnavailableDate}
              onChange={(e) => setNewUnavailableDate(e.target.value)}
              className="glass-input-solid"
            />
            <input
              type="text"
              value={newUnavailableReason}
              onChange={(e) => setNewUnavailableReason(e.target.value)}
              placeholder="Grund (optional)"
              className="glass-input-solid"
            />
            <button
              onClick={handleAddUnavailableDay}
              className="glass-button-secondary text-sm px-4 py-3"
            >
              Hinzufügen
            </button>
          </div>

          <div className="space-y-3">
            {unavailableDays.map((day) => (
              <div key={day.id} className="glass-list-item">
                <div>
                  <span className="font-medium text-gray-900">
                    {format(new Date(day.date), 'dd.MM.yyyy', { locale: de })}
                  </span>
                  {day.reason && <span className="ml-2 text-sm text-gray-500">({day.reason})</span>}
                </div>
                <button
                  onClick={() => handleDeleteUnavailableDay(day.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                >
                  Löschen
                </button>
              </div>
            ))}
            {unavailableDays.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">Keine F-Tage eingetragen</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
