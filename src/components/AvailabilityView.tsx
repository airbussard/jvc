'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, momentLocalizer, View, Event as CalendarEvent } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/de'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { createClient } from '@/lib/supabase'
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
            title: `🏖️ ${userName} - Urlaub${vacation.note ? `: ${vacation.note}` : ''}`,
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
            title: `🚫 ${userName} - F-Tag${day.reason ? `: ${day.reason}` : ''}`,
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
    let backgroundColor = '#3b82f6' // Default blue for events
    let borderColor = backgroundColor

    if (event.type === 'vacation') {
      backgroundColor = '#f59e0b' // Orange for vacations
      borderColor = '#d97706'
    } else if (event.type === 'unavailable') {
      backgroundColor = '#ef4444' // Red for unavailable days
      borderColor = '#dc2626'
    } else if (event.type === 'event') {
      const eventData = event.originalData as Event
      backgroundColor = eventData.color || '#3b82f6'
      borderColor = backgroundColor
    }

    const style = {
      backgroundColor,
      borderRadius: '5px',
      opacity: 0.9,
      color: 'white',
      border: `1px solid ${borderColor}`,
      display: 'block'
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

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Verfügbarkeitskalender</h2>
          <div className="flex items-center space-x-4">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Alle Personen</option>
              {users.map(user => (
                <option key={user.profile.id} value={user.profile.id}>
                  {user.profile.full_name || user.profile.id}
                </option>
              ))}
            </select>
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded mr-1"></span>
                Termine
              </span>
              <span className="flex items-center">
                <span className="w-3 h-3 bg-orange-500 rounded mr-1"></span>
                Urlaub
              </span>
              <span className="flex items-center">
                <span className="w-3 h-3 bg-red-500 rounded mr-1"></span>
                F-Tag
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <div className="flex-1">
          <div style={{ height: '600px' }} className="p-4">
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

        {/* Availability Summary Sidebar */}
        {availabilitySummary.length > 0 && (
          <div className="w-80 border-l border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Abwesenheiten im {view === 'month' ? 'Monat' : view === 'week' ? 'Woche' : 'Tag'}
            </h3>
            <div className="space-y-2">
              {availabilitySummary.map((summary, idx) => (
                <div key={idx} className="bg-gray-50 rounded p-2 text-sm">
                  <div className="font-medium text-gray-900">{summary.name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {summary.vacationDays > 0 && (
                      <span className="mr-3">🏖️ {summary.vacationDays} Urlaubstag(e)</span>
                    )}
                    {summary.unavailableDays > 0 && (
                      <span>🚫 {summary.unavailableDays} F-Tag(e)</span>
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowEventDetails(false)
                setSelectedEvent(null)
              }}
            />
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {selectedEvent.type === 'event' ? 'Termin-Details' :
                   selectedEvent.type === 'vacation' ? 'Urlaub-Details' : 'F-Tag-Details'}
                </h3>

                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Titel:</span>
                    <p className="text-sm text-gray-900">{selectedEvent.title}</p>
                  </div>

                  {selectedEvent.type === 'event' && (
                    <>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Zeit:</span>
                        <p className="text-sm text-gray-900">
                          {format(selectedEvent.start!, 'dd.MM.yyyy HH:mm', { locale: de })} -
                          {format(selectedEvent.end!, 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                      </div>
                      {(selectedEvent.originalData as Event).location && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Ort:</span>
                          <p className="text-sm text-gray-900">{(selectedEvent.originalData as Event).location}</p>
                        </div>
                      )}
                      {(selectedEvent.originalData as Event).description && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Beschreibung:</span>
                          <p className="text-sm text-gray-900">{(selectedEvent.originalData as Event).description}</p>
                        </div>
                      )}
                    </>
                  )}

                  {selectedEvent.type === 'vacation' && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Zeitraum:</span>
                      <p className="text-sm text-gray-900">
                        {format(new Date((selectedEvent.originalData as Vacation).start_date), 'dd.MM.yyyy', { locale: de })} -
                        {format(new Date((selectedEvent.originalData as Vacation).end_date), 'dd.MM.yyyy', { locale: de })}
                      </p>
                    </div>
                  )}

                  {selectedEvent.type === 'unavailable' && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Datum:</span>
                      <p className="text-sm text-gray-900">
                        {format(new Date((selectedEvent.originalData as UnavailableDay).date), 'dd.MM.yyyy', { locale: de })}
                      </p>
                    </div>
                  )}

                  {selectedEvent.userName && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Person:</span>
                      <p className="text-sm text-gray-900">{selectedEvent.userName}</p>
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEventDetails(false)
                      setSelectedEvent(null)
                    }}
                    className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:text-sm"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}