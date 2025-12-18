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

  const filteredCount = events.filter(e => {
    const eventStart = new Date(e.start)
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    return eventStart >= start && eventStart <= end
  }).length

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
        eventData.start = event.start
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
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div className="glass-overlay" onClick={onClose} />

      <div className="glass-modal w-full max-w-sm p-6 animate-glass-in">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-primary-900">Kalender exportieren</h3>
          <p className="mt-2 text-sm text-gray-600">
            Wähle den Zeitraum für den Export
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Von</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="glass-input-solid w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bis</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="glass-input-solid w-full"
            />
          </div>

          <div className="p-4 rounded-xl bg-secondary-50 border border-secondary-200">
            <p className="text-sm font-medium text-secondary-700">
              {filteredCount} {filteredCount === 1 ? 'Termin wird' : 'Termine werden'} exportiert
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="glass-button-outline text-sm px-4 py-3"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="glass-button-primary text-sm px-4 py-3"
          >
            Exportieren
          </button>
        </div>
      </div>
    </div>
  )
}
