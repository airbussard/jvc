'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, momentLocalizer, View, Event as CalendarEvent } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/de'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { createClient } from '@/lib/supabase'
import type { Database } from '@/types/database'
import EventModalExtended from '@/components/EventModalExtended'
import ExportDialog from '@/components/ExportDialog'

moment.locale('de')
const localizer = momentLocalizer(moment)

type UserRole = Database['public']['Tables']['profiles']['Row']['role']
type Event = Database['public']['Tables']['events']['Row']

interface CalendarViewProps {
  userRole: UserRole
}

interface CustomEvent extends CalendarEvent {
  id: string
  description?: string | null
  location?: string | null
  color?: string | null
  created_by?: string | null
  hasMyAttendance?: boolean
}

export default function CalendarView({ userRole }: CalendarViewProps) {
  const [events, setEvents] = useState<CustomEvent[]>([])
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CustomEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const canEditEvents = userRole === 'admin' || userRole === 'moderator'

  const loadEvents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_datetime', { ascending: true })

    if (!error && data && user) {
      // Get user's attendances
      const { data: attendances } = await supabase
        .from('event_attendances')
        .select('event_id')
        .eq('user_id', user.id)

      const attendedEventIds = attendances?.map((a: any) => a.event_id) || []

      const formattedEvents: CustomEvent[] = data.map((event: Event) => ({
        id: event.id,
        title: event.title,
        start: new Date(event.start_datetime),
        end: new Date(event.end_datetime),
        description: event.description,
        location: event.location,
        color: event.color,
        created_by: event.created_by,
        hasMyAttendance: attendedEventIds.includes(event.id)
      }))
      setEvents(formattedEvents)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const handleSelectEvent = (event: CustomEvent) => {
    setSelectedEvent(event)
    setShowEventModal(true)
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
    const style = {
      backgroundColor: event.color || '#3b82f6',
      borderRadius: '5px',
      opacity: 0.9,
      color: 'white',
      border: event.hasMyAttendance ? '2px solid #10b981' : '0px',
      display: 'block',
      boxShadow: event.hasMyAttendance ? '0 0 0 1px #10b981' : 'none'
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
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Terminkalender</h2>
          <div className="space-x-2">
            <button
              onClick={() => setShowExportDialog(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Kalender exportieren
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
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Neuer Termin
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: '600px' }} className="p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500">Lade Termine...</div>
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