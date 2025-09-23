'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import type { Database } from '@/types/database'

type AttendanceStatus = Database['public']['Enums']['attendance_status']

interface EventModalProps {
  event: any
  canEdit: boolean
  onClose: () => void
  onSave: () => void
}

const colorOptions = [
  { value: '#3b82f6', label: 'Blau', class: 'bg-blue-500' },
  { value: '#10b981', label: 'Grün', class: 'bg-green-500' },
  { value: '#f59e0b', label: 'Orange', class: 'bg-amber-500' },
  { value: '#ef4444', label: 'Rot', class: 'bg-red-500' },
  { value: '#8b5cf6', label: 'Lila', class: 'bg-purple-500' },
  { value: '#ec4899', label: 'Pink', class: 'bg-pink-500' },
  { value: '#6b7280', label: 'Grau', class: 'bg-gray-500' },
  { value: '#14b8a6', label: 'Türkis', class: 'bg-teal-500' },
]

export default function EventModalExtended({ event, canEdit, onClose, onSave }: EventModalProps) {
  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState(event?.description || '')
  const [location, setLocation] = useState(event?.location || '')
  const [color, setColor] = useState(event?.color || '#3b82f6')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myAttendance, setMyAttendance] = useState<AttendanceStatus | null>(null)
  const [attendances, setAttendances] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    if (event) {
      const start = new Date(event.start)
      const end = new Date(event.end)

      setStartDate(format(start, 'yyyy-MM-dd'))
      setStartTime(format(start, 'HH:mm'))
      setEndDate(format(end, 'yyyy-MM-dd'))
      setEndTime(format(end, 'HH:mm'))
      setColor(event.color || '#3b82f6')

      // Load attendances if event exists
      if (event.id) {
        loadAttendances()
      }
    }

    // Get current user
    getCurrentUser()
  }, [event])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    if (user && event?.id) {
      // Check if user has attendance
      const { data } = await supabase
        .from('event_attendances')
        .select('status')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .single()

      if (data) {
        setMyAttendance((data as any).status as AttendanceStatus)
      }
    }
  }

  const loadAttendances = async () => {
    if (!event?.id) return

    const { data } = await supabase
      .from('event_attendances')
      .select('*, profiles(full_name)')
      .eq('event_id', event.id)

    if (data) {
      setAttendances(data)
    }
  }

  const handleAttendanceChange = async (status: AttendanceStatus | 'remove') => {
    if (!event?.id || !currentUser) return

    if (status === 'remove') {
      await (supabase as any)
        .from('event_attendances')
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', currentUser.id)

      setMyAttendance(null)
    } else {
      const { data: existing } = await supabase
        .from('event_attendances')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', currentUser.id)
        .single()

      if (existing) {
        await (supabase as any)
          .from('event_attendances')
          .update({ status })
          .eq('id', (existing as any).id)
      } else {
        await (supabase as any)
          .from('event_attendances')
          .insert({
            event_id: event.id,
            user_id: currentUser.id,
            status
          })
      }

      setMyAttendance(status)
    }

    loadAttendances()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const startDateTime = new Date(`${startDate}T${startTime}`)
    const endDateTime = new Date(`${endDate}T${endTime}`)

    const eventData = {
      title,
      description,
      location,
      color,
      start_datetime: startDateTime.toISOString(),
      end_datetime: endDateTime.toISOString(),
    }

    try {
      if (event?.id) {
        const { error } = await (supabase as any)
          .from('events')
          .update(eventData)
          .eq('id', event.id)

        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await (supabase as any)
          .from('events')
          .insert({
            ...eventData,
            created_by: user?.id,
          })

        if (error) throw error
      }

      onSave()
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!event?.id || !confirm('Möchten Sie diesen Termin wirklich löschen?')) return

    setSaving(true)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', event.id)

    if (!error) {
      onSave()
    } else {
      setError(error.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {event?.id ? 'Termin bearbeiten' : 'Neuer Termin'}
              </h3>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Titel *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={!canEdit}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Ort</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={!canEdit}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              {canEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
                  <div className="flex space-x-2">
                    {colorOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setColor(option.value)}
                        className={`w-8 h-8 rounded-full ${option.class} ${
                          color === option.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                        }`}
                        title={option.label}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Startdatum *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    disabled={!canEdit}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Startzeit *</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    disabled={!canEdit}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Enddatum *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    disabled={!canEdit}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Endzeit *</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    disabled={!canEdit}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {event?.id && (
              <div className="border-t mt-4 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Meine Teilnahme</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => handleAttendanceChange('attending_onsite')}
                    className={`px-3 py-2 text-sm rounded-md border ${
                      myAttendance === 'attending_onsite'
                        ? 'bg-green-100 border-green-500 text-green-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Vor Ort
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAttendanceChange('attending_hybrid')}
                    className={`px-3 py-2 text-sm rounded-md border ${
                      myAttendance === 'attending_hybrid'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Hybrid
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAttendanceChange('absent')}
                    className={`px-3 py-2 text-sm rounded-md border ${
                      myAttendance === 'absent'
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Abwesend
                  </button>
                  {myAttendance && (
                    <button
                      type="button"
                      onClick={() => handleAttendanceChange('remove')}
                      className="px-3 py-2 text-sm rounded-md border bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Zurückziehen
                    </button>
                  )}
                </div>

                {attendances.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Teilnehmer ({attendances.length}):</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {attendances.map((att: any) => (
                        <div key={att.id} className="flex items-center justify-between text-sm">
                          <span>{att.profiles?.full_name || 'Unbekannt'}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            att.status === 'attending_onsite' ? 'bg-green-100 text-green-700' :
                            att.status === 'attending_hybrid' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {att.status === 'attending_onsite' ? 'Vor Ort' :
                             att.status === 'attending_hybrid' ? 'Hybrid' : 'Abwesend'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              {canEdit ? (
                <>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                  >
                    {saving ? 'Speichern...' : 'Speichern'}
                  </button>
                  {event?.id && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="inline-flex w-full justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-base font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:col-start-1 sm:row-start-1 sm:text-sm"
                    >
                      Löschen
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:col-span-2 sm:text-sm"
                >
                  Schließen
                </button>
              )}
              {canEdit && !event?.id && (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                >
                  Abbrechen
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}