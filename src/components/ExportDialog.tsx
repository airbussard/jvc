'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import ical from 'ical-generator'

interface ExportDialogProps {
  events: any[]
  onClose: () => void
}

export default function ExportDialog({ events, onClose }: ExportDialogProps) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))

  const handleExport = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const filteredEvents = events.filter(event => {
      const eventStart = new Date(event.start)
      return eventStart >= start && eventStart <= end
    })

    const calendar = ical({
      name: 'jVC Termine',
      description: 'Termine des Jugendverbands',
      timezone: 'Europe/Berlin',
    })

    filteredEvents.forEach(event => {
      const eventData: any = {
        summary: event.title,
        description: event.description || '',
        location: event.location || '',
      }

      if (event.allDay || event.is_all_day) {
        // For all-day events, use DATE instead of DATE-TIME
        eventData.start = event.start
        // Add one day to end date for all-day events (ICS uses exclusive end)
        // This ensures multi-day all-day events are displayed correctly
        const endDate = new Date(event.end)
        endDate.setDate(endDate.getDate() + 1)
        eventData.end = endDate
        eventData.allDay = true
      } else {
        eventData.start = event.start
        eventData.end = event.end
      }

      calendar.createEvent(eventData)
    })

    const icsContent = calendar.toString()
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `jvc-termine-${format(start, 'yyyy-MM-dd')}-${format(end, 'yyyy-MM-dd')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">Kalender exportieren</h3>
            <p className="mt-1 text-sm text-gray-500">
              Wählen Sie den Zeitraum für den Export
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Von</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Bis</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div className="mt-2 text-sm text-gray-500">
              {events.filter(e => {
                const eventStart = new Date(e.start)
                const start = new Date(startDate)
                const end = new Date(endDate)
                end.setHours(23, 59, 59, 999)
                return eventStart >= start && eventStart <= end
              }).length} Termine werden exportiert
            </div>
          </div>

          <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
            >
              Exportieren
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}