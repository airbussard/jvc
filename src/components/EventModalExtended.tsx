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
  { value: '#001a3f', label: 'Dunkelblau', class: 'bg-primary-900' },
  { value: '#c4d82e', label: 'Lime', class: 'bg-accent-500' },
  { value: '#3b82f6', label: 'Blau', class: 'bg-blue-500' },
  { value: '#10b981', label: 'Grün', class: 'bg-emerald-500' },
  { value: '#f59e0b', label: 'Orange', class: 'bg-amber-500' },
  { value: '#ef4444', label: 'Rot', class: 'bg-red-500' },
  { value: '#8b5cf6', label: 'Lila', class: 'bg-purple-500' },
  { value: '#14b8a6', label: 'Türkis', class: 'bg-teal-500' },
]

export default function EventModalExtended({ event, canEdit, onClose, onSave }: EventModalProps) {
  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState(event?.description || '')
  const [location, setLocation] = useState(event?.location || '')
  const [color, setColor] = useState(event?.color || '#1e5a8f')
  const [isAllDay, setIsAllDay] = useState(event?.is_all_day || false)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myAttendance, setMyAttendance] = useState<AttendanceStatus | null>(null)
  const [myRequiresExemption, setMyRequiresExemption] = useState(false)
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
      setColor(event.color || '#1e5a8f')
      setIsAllDay(event.is_all_day || false)

      if (event.id) {
        loadAttendances()
      }
    }

    getCurrentUser()
  }, [event])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    if (user && event?.id) {
      const { data } = await (supabase as any)
        .from('event_attendances')
        .select('status, requires_exemption')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .single()

      if (data) {
        setMyAttendance((data as any).status as AttendanceStatus)
        setMyRequiresExemption((data as any).requires_exemption || false)
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
      setMyRequiresExemption(false)
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
          .update({ status, requires_exemption: myRequiresExemption })
          .eq('id', (existing as any).id)
      } else {
        await (supabase as any)
          .from('event_attendances')
          .insert({
            event_id: event.id,
            user_id: currentUser.id,
            status,
            requires_exemption: myRequiresExemption
          })
      }

      setMyAttendance(status)
    }

    loadAttendances()
  }

  const handleExemptionChange = async (checked: boolean) => {
    setMyRequiresExemption(checked)

    if (!event?.id || !currentUser || !myAttendance) return

    // Update existing attendance with new exemption status
    await (supabase as any)
      .from('event_attendances')
      .update({ requires_exemption: checked })
      .eq('event_id', event.id)
      .eq('user_id', currentUser.id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const startDateTime = isAllDay
      ? new Date(`${startDate}T00:00:00`)
      : new Date(`${startDate}T${startTime}`)
    const endDateTime = isAllDay
      ? new Date(`${endDate}T23:59:59`)
      : new Date(`${endDate}T${endTime}`)

    const eventData = {
      title,
      description,
      location,
      color,
      is_all_day: isAllDay,
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
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="glass-overlay" onClick={onClose} />

      <div className="glass-modal w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 animate-glass-in max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-primary-900">
              {event?.id ? 'Termin bearbeiten' : 'Neuer Termin'}
            </h3>
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Titel *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={!canEdit}
                className="glass-input-solid w-full"
                placeholder="Termintitel eingeben"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={!canEdit}
                className="glass-input-solid w-full"
                placeholder="Optionale Beschreibung"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ort</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={!canEdit}
                className="glass-input-solid w-full"
                placeholder="Veranstaltungsort"
              />
            </div>

            {/* All Day Checkbox */}
            {canEdit && (
              <div className="space-y-3">
                <label className="flex items-center space-x-3 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    disabled={!canEdit}
                    className="w-5 h-5 rounded-lg border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>Ganztägiger Termin</span>
                </label>
              </div>
            )}

            {/* Color Selection */}
            {canEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Farbe</label>
                <div className="flex flex-wrap gap-3">
                  {colorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setColor(option.value)}
                      className={`w-10 h-10 rounded-xl transition-all duration-200 ${option.class} ${
                        color === option.value
                          ? 'ring-2 ring-offset-2 ring-accent-500 scale-110 shadow-lg'
                          : 'hover:scale-105 shadow-md'
                      }`}
                      title={option.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Date/Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Startdatum *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={!canEdit}
                  className="glass-input-solid w-full"
                />
              </div>
              {!isAllDay && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Startzeit *</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    disabled={!canEdit}
                    className="glass-input-solid w-full"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enddatum *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={!canEdit}
                  className="glass-input-solid w-full"
                />
              </div>
              {!isAllDay && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Endzeit *</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    disabled={!canEdit}
                    className="glass-input-solid w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Attendance Section */}
          {event?.id && (
            <div className="border-t border-gray-100 mt-6 pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Meine Teilnahme</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleAttendanceChange('attending_onsite')}
                  className={`px-4 py-3 text-sm rounded-xl border-2 transition-all duration-200 ${
                    myAttendance === 'attending_onsite'
                      ? 'bg-accent-100 border-accent-500 text-accent-800 shadow-md'
                      : 'bg-white/50 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  Vor Ort
                </button>
                <button
                  type="button"
                  onClick={() => handleAttendanceChange('attending_hybrid')}
                  className={`px-4 py-3 text-sm rounded-xl border-2 transition-all duration-200 ${
                    myAttendance === 'attending_hybrid'
                      ? 'bg-blue-100 border-blue-500 text-blue-700 shadow-md'
                      : 'bg-white/50 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  Hybrid
                </button>
                <button
                  type="button"
                  onClick={() => handleAttendanceChange('absent')}
                  className={`px-4 py-3 text-sm rounded-xl border-2 transition-all duration-200 ${
                    myAttendance === 'absent'
                      ? 'bg-red-100 border-red-500 text-red-700 shadow-md'
                      : 'bg-white/50 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  Abwesend
                </button>
                {myAttendance && (
                  <button
                    type="button"
                    onClick={() => handleAttendanceChange('remove')}
                    className="px-4 py-3 text-sm rounded-xl border-2 bg-white/50 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                  >
                    Zurückziehen
                  </button>
                )}
              </div>

              {/* Exemption Checkbox - only visible when attending */}
              {myAttendance && myAttendance !== 'absent' && (
                <div className="mt-4">
                  <label className="flex items-center space-x-3 text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={myRequiresExemption}
                      onChange={(e) => handleExemptionChange(e.target.checked)}
                      className="w-5 h-5 rounded-lg border-gray-300 text-accent-600 focus:ring-accent-500"
                    />
                    <span>Ich benötige eine Freistellung</span>
                  </label>
                </div>
              )}

              {attendances.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-gray-700 mb-3">Teilnehmer ({attendances.length}):</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {attendances.map((att: any) => (
                      <div key={att.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                        <span className="text-sm font-medium text-gray-900">{att.profiles?.full_name || 'Unbekannt'}</span>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          att.status === 'attending_onsite' ? 'bg-accent-100 text-accent-800' :
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

          {/* Action Buttons */}
          <div className="mt-6 space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
            {canEdit ? (
              <>
                <button
                  type="submit"
                  disabled={saving}
                  className="glass-button-primary w-full sm:order-2"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
                {event?.id ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="glass-button-danger w-full sm:order-1"
                  >
                    Löschen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="glass-button-outline w-full sm:order-1"
                  >
                    Abbrechen
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="glass-button-outline w-full col-span-2"
              >
                Schließen
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
