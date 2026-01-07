'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, momentLocalizer, View, Event as CalendarEvent } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/de'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { createClient } from '@/lib/supabase'
import { GlassSelect } from './GlassSelect'
import type { Database } from '@/types/database'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

moment.locale('de')
const localizer = momentLocalizer(moment)

type Event = Database['public']['Tables']['events']['Row']
type Vacation = Database['public']['Tables']['vacations']['Row']
type UnavailableDay = Database['public']['Tables']['unavailable_days']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

interface CustomEvent extends CalendarEvent {
  id: string
  type: 'event' | 'vacation' | 'unavailable'
  userId?: string
  userName?: string
  originalData?: Event | Vacation | UnavailableDay
}

interface UserAvailability {
  profile: any
  vacations: Vacation[]
  unavailableDays: UnavailableDay[]
}

export default function AvailabilityView() {
  const [events, setEvents] = useState<CustomEvent[]>([])
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [users, setUsers] = useState<UserAvailability[]>([])
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CustomEvent | null>(null)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    // Load all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')

    if (!profiles) {
      setLoading(false)
      return
    }

    // Load events
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .order('start_datetime', { ascending: true })

    // Load vacations
    const { data: vacationsData } = await supabase
      .from('vacations')
      .select('*')
      .order('start_date', { ascending: true })

    // Load unavailable days
    const { data: unavailableDaysData } = await supabase
      .from('unavailable_days')
      .select('*')
      .order('date', { ascending: true })

    // Organize user availability data
    const userAvailability: UserAvailability[] = profiles.map((profile: any) => ({
      profile,
      vacations: vacationsData?.filter((v: any) => v.user_id === profile.id) || [],
      unavailableDays: unavailableDaysData?.filter((u: any) => u.user_id === profile.id) || []
    }))

    setUsers(userAvailability)

    // Create combined events array
    const allEvents: CustomEvent[] = []

    // Add regular events
    if (eventsData) {
      eventsData.forEach((event: Event) => {
        allEvents.push({
          id: event.id,
          title: event.title,
          start: new Date(event.start_datetime),
          end: new Date(event.end_datetime),
          type: 'event',
          originalData: event
        })
      })
    }

    // Add vacations as events (if viewing all or specific user)
    if (vacationsData) {
      vacationsData.forEach((vacation: Vacation) => {
        if (selectedUser === 'all' || selectedUser === vacation.user_id) {
          const user: any = profiles.find((p: any) => p.id === vacation.user_id)
          const userName = user?.full_name || 'Unbekannt'

          // Create an event for each day of vacation
          const startDate = new Date(vacation.start_date)
          const endDate = new Date(vacation.end_date)

          allEvents.push({
            id: `vacation-${vacation.id}`,
            title: `${userName} - Urlaub${vacation.note ? `: ${vacation.note}` : ''}`,
            start: startDate,
            end: new Date(endDate.getTime() + 24 * 60 * 60 * 1000), // Add one day for proper display
            type: 'vacation',
            userId: vacation.user_id,
            userName,
            originalData: vacation
          })
        }
      })
    }

    // Add unavailable days as events
    if (unavailableDaysData) {
      unavailableDaysData.forEach((day: UnavailableDay) => {
        if (selectedUser === 'all' || selectedUser === day.user_id) {
          const user: any = profiles.find((p: any) => p.id === day.user_id)
          const userName = user?.full_name || 'Unbekannt'

          allEvents.push({
            id: `unavailable-${day.id}`,
            title: `${userName} - F-Tag${day.reason ? `: ${day.reason}` : ''}`,
            start: new Date(day.date),
            end: new Date(new Date(day.date).getTime() + 24 * 60 * 60 * 1000),
            type: 'unavailable',
            userId: day.user_id,
            userName,
            originalData: day
          })
        }
      })
    }

    setEvents(allEvents)
    setLoading(false)
  }, [supabase, selectedUser])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSelectEvent = (event: CustomEvent) => {
    setSelectedEvent(event)
    setShowEventDetails(true)
  }

  const eventStyleGetter = (event: CustomEvent) => {
    let backgroundColor = '#1e5a8f' // Default primary blue for events
    let borderColor = backgroundColor

    if (event.type === 'vacation') {
      backgroundColor = '#f59e0b' // Orange for vacations
      borderColor = '#d97706'
    } else if (event.type === 'unavailable') {
      backgroundColor = '#ef4444' // Red for unavailable days
      borderColor = '#dc2626'
    } else if (event.type === 'event') {
      const eventData = event.originalData as Event
      backgroundColor = eventData.color || '#1e5a8f'
      borderColor = backgroundColor
    }

    const style = {
      backgroundColor,
      borderRadius: '8px',
      opacity: 0.95,
      color: 'white',
      border: `1px solid ${borderColor}`,
      display: 'block',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }

    return { style }
  }

  const EventComponent = ({ event }: { event: CustomEvent }) => (
    <div className="text-xs">
      <span className="truncate">{event.title}</span>
    </div>
  )

  // Calculate availability summary for current view
  const getAvailabilitySummary = () => {
    const viewStart = moment(date).startOf(view as any).toDate()
    const viewEnd = moment(date).endOf(view as any).toDate()

    const summary = users.map(user => {
      const vacationDays = user.vacations.filter(v => {
        const start = new Date(v.start_date)
        const end = new Date(v.end_date)
        return (start <= viewEnd && end >= viewStart)
      }).length

      const unavailableDays = user.unavailableDays.filter(d => {
        const day = new Date(d.date)
        return day >= viewStart && day <= viewEnd
      }).length

      return {
        name: user.profile.full_name || user.profile.id,
        vacationDays,
        unavailableDays,
        totalUnavailable: vacationDays + unavailableDays
      }
    })

    return summary.filter(s => s.totalUnavailable > 0)
  }

  const availabilitySummary = getAvailabilitySummary()

  const userOptions = useMemo(() => [
    { value: 'all', label: 'Alle Personen' },
    ...users.map(user => ({
      value: user.profile.id,
      label: user.profile.full_name || user.profile.id
    }))
  ], [users])

  return (
    <div className="glass-card-solid overflow-hidden">
      {/* Header */}
      <div className="section-header">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
            <h2 className="text-xl font-semibold text-primary-900">Verfügbarkeitskalender</h2>
            <GlassSelect
              value={selectedUser}
              onChange={setSelectedUser}
              options={userOptions}
              className="w-full sm:w-48"
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center">
              <span className="w-4 h-4 bg-primary-500 rounded-lg mr-2 shadow-sm"></span>
              <span className="text-gray-700">Termine</span>
            </span>
            <span className="flex items-center">
              <span className="w-4 h-4 bg-amber-500 rounded-lg mr-2 shadow-sm"></span>
              <span className="text-gray-700">Urlaub</span>
            </span>
            <span className="flex items-center">
              <span className="w-4 h-4 bg-red-500 rounded-lg mr-2 shadow-sm"></span>
              <span className="text-gray-700">F-Tag</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Calendar */}
        <div className="flex-1">
          <div className="p-4 sm:p-6">
            {/* Mobile Calendar */}
            <div style={{ height: '400px' }} className="sm:hidden">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-gray-500">Lade Verfügbarkeiten...</div>
                </div>
              ) : (
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  view={view === 'agenda' || view === 'month' ? view : 'month'}
                  onView={(newView) => setView(newView)}
                  date={date}
                  onNavigate={(newDate) => setDate(newDate)}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={eventStyleGetter}
                  components={{
                    event: EventComponent
                  }}
                  views={['month', 'agenda']}
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
                    event: 'Eintrag',
                    noEventsInRange: 'Keine Einträge',
                  }}
                />
              )}
            </div>

            {/* Desktop Calendar */}
            <div style={{ height: '600px' }} className="hidden sm:block">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-gray-500">Lade Verfügbarkeiten...</div>
                </div>
              ) : (
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  view={view}
                  onView={(newView) => setView(newView)}
                  date={date}
                  onNavigate={(newDate) => setDate(newDate)}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={eventStyleGetter}
                  components={{
                    event: EventComponent
                  }}
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
                    event: 'Eintrag',
                    noEventsInRange: 'Keine Einträge in diesem Zeitraum',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Availability Summary Sidebar */}
        {availabilitySummary.length > 0 && (
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/50 p-5">
            <h3 className="text-sm font-semibold text-primary-900 mb-4">
              Abwesenheiten im {view === 'month' ? 'Monat' : view === 'week' ? 'dieser Woche' : 'Tag'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {availabilitySummary.map((summary, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className="font-medium text-gray-900 mb-2">{summary.name}</div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {summary.vacationDays > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-2 h-2 bg-amber-500 rounded-full mr-1.5"></span>
                        {summary.vacationDays} Urlaub
                      </span>
                    )}
                    {summary.unavailableDays > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>
                        {summary.unavailableDays} F-Tag
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="glass-overlay"
            onClick={() => {
              setShowEventDetails(false)
              setSelectedEvent(null)
            }}
          />

          <div className="glass-modal w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 animate-glass-in">
            <div className="mb-6">
              <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium mb-3 ${
                selectedEvent.type === 'event'
                  ? 'bg-primary-100 text-primary-700'
                  : selectedEvent.type === 'vacation'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {selectedEvent.type === 'event' ? 'Termin' :
                 selectedEvent.type === 'vacation' ? 'Urlaub' : 'F-Tag'}
              </div>
              <h3 className="text-xl font-semibold text-primary-900">
                {selectedEvent.type === 'event' ? 'Termin-Details' :
                 selectedEvent.type === 'vacation' ? 'Urlaub-Details' : 'F-Tag-Details'}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Titel</span>
                <p className="mt-1 text-sm font-medium text-gray-900">{selectedEvent.title}</p>
              </div>

              {selectedEvent.type === 'event' && (
                <>
                  <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zeit</span>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {format(selectedEvent.start!, 'dd.MM.yyyy HH:mm', { locale: de })} - {format(selectedEvent.end!, 'dd.MM.yyyy HH:mm', { locale: de })}
                    </p>
                  </div>
                  {(selectedEvent.originalData as Event).location && (
                    <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ort</span>
                      <p className="mt-1 text-sm font-medium text-gray-900">{(selectedEvent.originalData as Event).location}</p>
                    </div>
                  )}
                  {(selectedEvent.originalData as Event).description && (
                    <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Beschreibung</span>
                      <p className="mt-1 text-sm text-gray-900">{(selectedEvent.originalData as Event).description}</p>
                    </div>
                  )}
                </>
              )}

              {selectedEvent.type === 'vacation' && (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-100">
                  <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Zeitraum</span>
                  <p className="mt-1 text-sm font-medium text-amber-900">
                    {format(new Date((selectedEvent.originalData as Vacation).start_date), 'dd.MM.yyyy', { locale: de })} - {format(new Date((selectedEvent.originalData as Vacation).end_date), 'dd.MM.yyyy', { locale: de })}
                  </p>
                </div>
              )}

              {selectedEvent.type === 'unavailable' && (
                <div className="p-4 rounded-xl bg-red-50/80 border border-red-100">
                  <span className="text-xs font-medium text-red-600 uppercase tracking-wide">Datum</span>
                  <p className="mt-1 text-sm font-medium text-red-900">
                    {format(new Date((selectedEvent.originalData as UnavailableDay).date), 'dd.MM.yyyy', { locale: de })}
                  </p>
                </div>
              )}

              {selectedEvent.userName && (
                <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Person</span>
                  <p className="mt-1 text-sm font-medium text-gray-900">{selectedEvent.userName}</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowEventDetails(false)
                  setSelectedEvent(null)
                }}
                className="glass-button-outline w-full"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
