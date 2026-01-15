'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { GlassSelect } from './GlassSelect'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import type { Database } from '@/types/database'

type Event = Database['public']['Tables']['events']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Airline = Database['public']['Tables']['airlines']['Row']

interface ExemptionEntry {
  id: string
  userName: string
  userId: string
  airlineId: string | null
  airlineName: string | null
  eventTitle: string
  eventDate: Date
  eventEndDate: Date
  isAllDay: boolean
}

export default function ExemptionsView() {
  const [exemptions, setExemptions] = useState<ExemptionEntry[]>([])
  const [airlines, setAirlines] = useState<Airline[]>([])
  const [selectedAirline, setSelectedAirline] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([loadAirlines(), loadExemptions()])
    setLoading(false)
  }

  const loadAirlines = async () => {
    const { data, error } = await supabase
      .from('airlines')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      setAirlines(data as Airline[])
    }
  }

  const loadExemptions = async () => {
    // Load attendances where requires_exemption = true (nur Vor Ort und Hybrid)
    const { data: attendances, error: attendancesError } = await (supabase as any)
      .from('event_attendances')
      .select('*, profiles(id, full_name, airline_id), events(id, title, start_datetime, end_datetime, is_all_day)')
      .eq('requires_exemption', true)
      .in('status', ['attending_onsite', 'attending_hybrid'])

    if (attendancesError) {
      console.error('Error loading attendances:', attendancesError)
      return
    }

    if (!attendances || attendances.length === 0) {
      setExemptions([])
      return
    }

    // Load airlines for mapping
    const { data: airlinesData } = await (supabase as any)
      .from('airlines')
      .select('*')

    const airlinesMap = new Map((airlinesData as Airline[] || []).map(a => [a.id, a.name]))

    // Build exemption entries
    const entries: ExemptionEntry[] = []

    for (const attendance of attendances) {
      const event = (attendance as any).events
      const profile = (attendance as any).profiles as Profile | null

      if (event && profile) {
        entries.push({
          id: attendance.id,
          userName: profile.full_name || 'Unbekannt',
          userId: profile.id,
          airlineId: profile.airline_id,
          airlineName: profile.airline_id ? airlinesMap.get(profile.airline_id) || null : null,
          eventTitle: event.title,
          eventDate: new Date(event.start_datetime),
          eventEndDate: new Date(event.end_datetime),
          isAllDay: event.is_all_day,
        })
      }
    }

    // Sort by date, then by name
    entries.sort((a, b) => {
      const dateCompare = a.eventDate.getTime() - b.eventDate.getTime()
      if (dateCompare !== 0) return dateCompare
      return a.userName.localeCompare(b.userName)
    })

    setExemptions(entries)
  }

  const airlineOptions = useMemo(() => [
    { value: 'all', label: 'Alle Airlines' },
    { value: 'none', label: 'Ohne Airline' },
    ...airlines.map(a => ({ value: a.id, label: a.name }))
  ], [airlines])

  const goToPreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 2, 1)
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }

  const goToNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month, 1)
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }

  const getMonthLabel = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    return format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: de })
  }

  const filteredExemptions = useMemo(() => {
    let filtered = exemptions

    // Filter by airline
    if (selectedAirline === 'none') {
      filtered = filtered.filter(e => !e.airlineId)
    } else if (selectedAirline !== 'all') {
      filtered = filtered.filter(e => e.airlineId === selectedAirline)
    }

    // Filter by month
    const [year, month] = selectedMonth.split('-').map(Number)
    filtered = filtered.filter(e => {
      const eventYear = e.eventDate.getFullYear()
      const eventMonth = e.eventDate.getMonth() + 1
      return eventYear === year && eventMonth === month
    })

    return filtered
  }, [exemptions, selectedAirline, selectedMonth])

  const formatEventDate = (entry: ExemptionEntry) => {
    const startDate = format(entry.eventDate, 'dd.MM.yyyy', { locale: de })
    const endDate = format(entry.eventEndDate, 'dd.MM.yyyy', { locale: de })

    if (startDate === endDate) {
      if (entry.isAllDay) {
        return startDate
      }
      return `${startDate}, ${format(entry.eventDate, 'HH:mm')} - ${format(entry.eventEndDate, 'HH:mm')}`
    }

    return `${startDate} - ${endDate}`
  }

  const handleExportPDF = async () => {
    if (selectedAirline === 'all' || selectedAirline === 'none') {
      alert('Bitte wähle eine spezifische Airline für den PDF-Export.')
      return
    }

    try {
      const response = await fetch(`/api/exemptions/pdf?airline_id=${selectedAirline}&month=${selectedMonth}`)
      if (!response.ok) {
        throw new Error('PDF-Generierung fehlgeschlagen')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const airlineName = airlines.find(a => a.id === selectedAirline)?.name || 'Freistellungen'
      a.download = `Freistellungen_${airlineName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('PDF export error:', error)
      alert('Fehler beim PDF-Export. Bitte versuche es erneut.')
    }
  }

  return (
    <div className="glass-card-solid overflow-hidden">
      {/* Header */}
      <div className="section-header">
        <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
          <h2 className="text-xl font-semibold text-primary-900">Freistellungen</h2>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex items-center gap-1">
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                aria-label="Vorheriger Monat"
              >
                <svg className="w-5 h-5 text-primary-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-primary-900 font-medium min-w-[140px] text-center">
                {getMonthLabel()}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                aria-label="Nächster Monat"
              >
                <svg className="w-5 h-5 text-primary-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
            <GlassSelect
              value={selectedAirline}
              onChange={setSelectedAirline}
              options={airlineOptions}
              className="w-full sm:w-48"
            />
            <button
              onClick={handleExportPDF}
              disabled={selectedAirline === 'all' || selectedAirline === 'none' || filteredExemptions.length === 0}
              className="glass-button-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              PDF Exportieren
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-gray-500 text-center py-8">Lade Freistellungen...</p>
        ) : filteredExemptions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Keine Freistellungen für diesen Zeitraum.
          </p>
        ) : (
          <>
            {/* Mobile view: Cards */}
            <div className="sm:hidden space-y-4">
              {filteredExemptions.map((entry) => (
                <div key={entry.id} className="p-4 rounded-xl bg-gray-50/50 border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{entry.userName}</span>
                    {entry.airlineName && (
                      <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-lg">
                        {entry.airlineName}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">{entry.eventTitle}</span>
                  </div>
                  <div>
                    <span className="text-sm text-primary-600 font-medium">{formatEventDate(entry)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view: Table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Airline
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Termin
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Datum
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredExemptions.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.airlineName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.eventTitle}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-600 font-medium">
                        {formatEventDate(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-gray-500 text-center">
              {filteredExemptions.length} Freistellung{filteredExemptions.length !== 1 ? 'en' : ''}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
