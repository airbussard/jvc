'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, momentLocalizer, View, Event as CalendarEvent } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/de'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { createClient } from '@/lib/supabase'
import { GlassSelect } from './GlassSelect'
import type { Database } from '@/types/database'
import EventModalExtended from '@/components/EventModalExtended'
import ExportDialog from '@/components/ExportDialog'

moment.locale('de')
const localizer = momentLocalizer(moment)

type UserRole = Database['public']['Tables']['profiles']['Row']['role']
type Event = Database['public']['Tables']['events']['Row']
type Vacation = Database['public']['Tables']['vacations']['Row']
type UnavailableDay = Database['public']['Tables']['unavailable_days']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

interface CalendarViewProps {
  userRole: UserRole
}

interface CustomEvent extends CalendarEvent {
  id: string
  allDay?: boolean
  description?: string | null
  location?: string | null
  color?: string | null
  created_by?: string | null
  hasMyAttendance?: boolean
  is_all_day?: boolean
  type?: 'event' | 'vacation' | 'unavailable'
  userName?: string
}

export default function CalendarView({ userRole }: CalendarViewProps) {
  const [events, setEvents] = useState<CustomEvent[]>([])
  const [absenceEvents, setAbsenceEvents] = useState<CustomEvent[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CustomEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [loading, setLoading] = useState(true)

  // Filter states
  const [showAbsences, setShowAbsences] = useState(false)
  const [showOnlyMyEvents, setShowOnlyMyEvents] = useState(false)
  const [absenceFilter, setAbsenceFilter] = useState<string>('all')

  const supabase = createClient()

  const canEditEvents = userRole === 'admin' || userRole === 'moderator'

  const loadEvents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    // Load profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')

    if (profilesData) setProfiles(profilesData as Profile[])

    // Load events
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_datetime', { ascending: true })

    if (!error && data && user) {
      const { data: attendances } = await supabase
        .from('event_attendances')
        .select('event_id')
        .eq('user_id', user.id)

      const attendedEventIds = attendances?.map((a: any) => a.event_id) || []

      const formattedEvents: CustomEvent[] = data.map((event: any) => ({
        id: event.id,
        title: event.title,
        start: new Date(event.start_datetime),
        end: new Date(event.end_datetime),
        allDay: event.is_all_day || false,
        description: event.description,
        location: event.location,
        color: event.color,
        created_by: event.created_by,
        hasMyAttendance: attendedEventIds.includes(event.id),
        type: 'event' as const
      }))
      setEvents(formattedEvents)
    }

    // Load absences (vacations and unavailable days)
    const { data: vacationsData } = await supabase
      .from('vacations')
      .select('*')
      .order('start_date', { ascending: true })

    const { data: unavailableDaysData } = await supabase
      .from('unavailable_days')
      .select('*')
      .order('date', { ascending: true })

    const absences: CustomEvent[] = []

    if (vacationsData && profilesData) {
      vacationsData.forEach((vacation: Vacation) => {
        const profile = profilesData.find((p: any) => p.id === vacation.user_id)
        const userName = (profile as any)?.full_name || 'Unbekannt'
        absences.push({
          id: `vacation-${vacation.id}`,
          title: `${userName} - Urlaub${vacation.note ? `: ${vacation.note}` : ''}`,
          start: new Date(vacation.start_date),
          end: new Date(new Date(vacation.end_date).getTime() + 24 * 60 * 60 * 1000),
          allDay: true,
          type: 'vacation' as const,
          userName,
          created_by: vacation.user_id
        })
      })
    }

    if (unavailableDaysData && profilesData) {
      unavailableDaysData.forEach((day: UnavailableDay) => {
        const profile = profilesData.find((p: any) => p.id === day.user_id)
        const userName = (profile as any)?.full_name || 'Unbekannt'
        absences.push({
          id: `unavailable-${day.id}`,
          title: `${userName} - F-Tag${day.reason ? `: ${day.reason}` : ''}`,
          start: new Date(day.date),
          end: new Date(new Date(day.date).getTime() + 24 * 60 * 60 * 1000),
          allDay: true,
          type: 'unavailable' as const,
          userName,
          created_by: day.user_id
        })
      })
    }

    setAbsenceEvents(absences)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // User options for absence filter
  const userOptions = useMemo(() => [
    { value: 'all', label: 'Alle Personen' },
    { value: 'me', label: 'Nur meine' },
    ...profiles.map(p => ({ value: p.id, label: p.full_name || p.id }))
  ], [profiles])

  // Filter and combine events
  const displayedEvents = useMemo(() => {
    let filtered = events

    // Filter: nur meine Termine
    if (showOnlyMyEvents) {
      filtered = filtered.filter(e => e.hasMyAttendance)
    }

    // Abwesenheiten hinzufügen wenn aktiviert
    if (showAbsences) {
      let absencesToShow = absenceEvents
      if (absenceFilter === 'me' && currentUserId) {
        absencesToShow = absenceEvents.filter(a => a.created_by === currentUserId)
      } else if (absenceFilter !== 'all') {
        absencesToShow = absenceEvents.filter(a => a.created_by === absenceFilter)
      }
      filtered = [...filtered, ...absencesToShow]
    }

    return filtered
  }, [events, absenceEvents, showOnlyMyEvents, showAbsences, absenceFilter, currentUserId])

  const handleSelectEvent = (event: CustomEvent) => {
    // Nur Event-Modal für echte Termine öffnen
    if (event.type === 'event' || !event.type) {
      setSelectedEvent(event)
      setShowEventModal(true)
    }
  }

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    if (!canEditEvents) return

    setSelectedEvent({
      id: '',
      title: '',
      start: slotInfo.start,
      end: slotInfo.end,
    })
    setShowEventModal(true)
  }

  const eventStyleGetter = (event: CustomEvent) => {
    let backgroundColor = event.color || '#001a3f'
    let border = event.hasMyAttendance ? '2px solid #34bcee' : '0px'
    let boxShadow = event.hasMyAttendance
      ? '0 0 0 2px rgba(52, 188, 238, 0.3), 0 4px 12px rgba(0,0,0,0.15)'
      : '0 2px 8px rgba(0,0,0,0.1)'

    // Abwesenheits-Styling
    if (event.type === 'vacation') {
      backgroundColor = '#f59e0b' // Orange
      border = '1px solid #d97706'
      boxShadow = '0 2px 8px rgba(245, 158, 11, 0.2)'
    } else if (event.type === 'unavailable') {
      backgroundColor = '#ef4444' // Rot
      border = '1px solid #dc2626'
      boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)'
    }

    const style = {
      backgroundColor,
      borderRadius: '8px',
      opacity: 0.95,
      color: 'white',
      border,
      display: 'block',
      boxShadow
    }
    return { style }
  }

  const EventComponent = ({ event }: { event: CustomEvent }) => (
    <div className="flex items-center justify-between">
      <span className="truncate">{event.title}</span>
      {event.hasMyAttendance && (
        <span className="ml-1 text-xs">✓</span>
      )}
    </div>
  )

  return (
    <div className="glass-card-solid overflow-hidden">
      {/* Header */}
      <div className="section-header">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
            <h2 className="text-xl font-semibold text-primary-900">Terminkalender</h2>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setShowExportDialog(true)}
                className="glass-button-outline text-sm px-4 py-2"
              >
                <span className="hidden sm:inline">Kalender exportieren</span>
                <span className="sm:hidden">Exportieren</span>
              </button>
              {canEditEvents && (
                <button
                  onClick={() => {
                    setSelectedEvent({
                      id: '',
                      title: '',
                      start: new Date(),
                      end: new Date(),
                    })
                    setShowEventModal(true)
                  }}
                  className="glass-button-secondary text-sm px-4 py-2"
                >
                  Neuer Termin
                </button>
              )}
            </div>
          </div>

          {/* Filter Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyMyEvents}
                onChange={(e) => setShowOnlyMyEvents(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>Nur meine Termine</span>
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAbsences}
                  onChange={(e) => setShowAbsences(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>Abwesenheiten</span>
              </label>

              {showAbsences && (
                <GlassSelect
                  value={absenceFilter}
                  onChange={setAbsenceFilter}
                  options={userOptions}
                  className="w-40"
                />
              )}
            </div>

            {/* Legende */}
            {showAbsences && (
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-primary-600 rounded"></span>
                  Termin
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-amber-500 rounded"></span>
                  Urlaub
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-500 rounded"></span>
                  F-Tag
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="p-4 sm:p-6">
        {/* Mobile Calendar */}
        <div style={{ height: '400px' }} className="sm:hidden">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500">Lade Termine...</div>
            </div>
          ) : (
            <Calendar
              localizer={localizer}
              events={displayedEvents}
              startAccessor="start"
              endAccessor="end"
              view={view === 'agenda' || view === 'month' ? view : 'month'}
              onView={(newView) => setView(newView)}
              date={date}
              onNavigate={(newDate) => setDate(newDate)}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable={canEditEvents}
              eventPropGetter={eventStyleGetter}
              views={['month', 'agenda']}
              length={365}
              messages={{
                today: 'Heute',
                previous: '←',
                next: '→',
                month: 'Monat',
                week: 'Woche',
                day: 'Tag',
                agenda: 'Liste',
                date: 'Datum',
                time: 'Zeit',
                event: 'Termin',
                noEventsInRange: 'Keine Termine',
              }}
            />
          )}
        </div>

        {/* Desktop Calendar */}
        <div style={{ height: '600px' }} className="hidden sm:block">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500">Lade Termine...</div>
            </div>
          ) : (
            <Calendar
              localizer={localizer}
              events={displayedEvents}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={(newView) => setView(newView)}
              date={date}
              onNavigate={(newDate) => setDate(newDate)}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable={canEditEvents}
              eventPropGetter={eventStyleGetter}
              messages={{
                today: 'Heute',
                previous: 'Zurück',
                next: 'Weiter',
                month: 'Monat',
                week: 'Woche',
                day: 'Tag',
                agenda: 'Agenda',
                date: 'Datum',
                time: 'Zeit',
                event: 'Termin',
                noEventsInRange: 'Keine Termine in diesem Zeitraum',
              }}
            />
          )}
        </div>
      </div>

      {showEventModal && (
        <EventModalExtended
          event={selectedEvent}
          canEdit={canEditEvents}
          onClose={() => {
            setShowEventModal(false)
            setSelectedEvent(null)
          }}
          onSave={() => {
            setShowEventModal(false)
            setSelectedEvent(null)
            loadEvents()
          }}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          events={events}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  )
}
