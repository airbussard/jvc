import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PDFDocument from 'pdfkit'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // Get airline_id and month from query params
  const airlineId = request.nextUrl.searchParams.get('airline_id')
  const month = request.nextUrl.searchParams.get('month') // Format: YYYY-MM
  if (!airlineId) {
    return NextResponse.json({ error: 'Airline ID fehlt' }, { status: 400 })
  }

  try {
    // Load airline
    const { data: airlineData, error: airlineError } = await (supabase as any)
      .from('airlines')
      .select('*')
      .eq('id', airlineId)
      .single()

    if (airlineError || !airlineData) {
      return NextResponse.json({ error: 'Airline nicht gefunden' }, { status: 404 })
    }

    const airline = airlineData as { id: string; name: string; created_at: string }

    // Load attendances where requires_exemption = true, filtered by airline
    const { data: attendances, error: attendancesError } = await (supabase as any)
      .from('event_attendances')
      .select('*, profiles!inner(id, full_name, airline_id), events(id, title, start_datetime, end_datetime, is_all_day)')
      .eq('requires_exemption', true)
      .eq('profiles.airline_id', airlineId)
      .in('status', ['attending_onsite', 'attending_hybrid'])

    if (attendancesError) {
      throw attendancesError
    }

    if (!attendances || attendances.length === 0) {
      return NextResponse.json({ error: 'Keine Freistellungen für diese Airline' }, { status: 404 })
    }

    // Parse month filter
    let filterYear: number | null = null
    let filterMonth: number | null = null
    if (month) {
      const [y, m] = month.split('-').map(Number)
      if (y && m) {
        filterYear = y
        filterMonth = m
      }
    }

    // Build exemption data
    const exemptions: { name: string; eventTitle: string; date: string }[] = []

    for (const attendance of attendances) {
      const event = (attendance as any).events
      const profile = (attendance as any).profiles

      if (event && profile) {
        const startDate = new Date(event.start_datetime)
        const endDate = new Date(event.end_datetime)

        // Filter by month if specified
        if (filterYear && filterMonth) {
          const eventYear = startDate.getFullYear()
          const eventMonth = startDate.getMonth() + 1
          if (eventYear !== filterYear || eventMonth !== filterMonth) {
            continue
          }
        }

        const formatDate = (d: Date) => d.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })

        let dateStr = formatDate(startDate)
        if (formatDate(startDate) !== formatDate(endDate)) {
          dateStr = `${formatDate(startDate)} - ${formatDate(endDate)}`
        }

        exemptions.push({
          name: profile.full_name || 'Unbekannt',
          eventTitle: event.title,
          date: dateStr,
        })
      }
    }

    // Sort by date, then by name
    exemptions.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.name.localeCompare(b.name)
    })

    if (exemptions.length === 0) {
      return NextResponse.json({ error: 'Keine Freistellungen für diesen Zeitraum' }, { status: 404 })
    }

    // Format month for display
    const monthLabel = filterYear && filterMonth
      ? new Date(filterYear, filterMonth - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      : null

    // Generate PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Freistellungen - ${airline.name}${monthLabel ? ` - ${monthLabel}` : ''}`,
        Author: 'jVC Terminverwaltung',
      }
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('jVC - Freistellungen', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(14).font('Helvetica').text(`Airline: ${airline.name}`, { align: 'center' })
    if (monthLabel) {
      doc.fontSize(12).text(`Zeitraum: ${monthLabel}`, { align: 'center' })
    }
    doc.fontSize(10).text(`Erstellt am: ${new Date().toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, { align: 'center' })
    doc.moveDown(2)

    // Table header
    const tableTop = doc.y
    const col1 = 50
    const col2 = 200
    const col3 = 380
    const colWidth1 = 145
    const colWidth2 = 175
    const colWidth3 = 130

    doc.font('Helvetica-Bold').fontSize(11)
    doc.text('Name', col1, tableTop, { width: colWidth1 })
    doc.text('Termin', col2, tableTop, { width: colWidth2 })
    doc.text('Datum', col3, tableTop, { width: colWidth3 })

    // Header underline
    doc.moveTo(col1, tableTop + 18).lineTo(col3 + colWidth3, tableTop + 18).stroke()
    doc.moveDown(1.5)

    // Table rows
    doc.font('Helvetica').fontSize(10)
    let rowIndex = 0

    for (const item of exemptions) {
      const y = doc.y

      // Check if we need a new page
      if (y > 750) {
        doc.addPage()
        rowIndex = 0
      }

      // Zebra striping
      if (rowIndex % 2 === 1) {
        doc.save()
        doc.fillColor('#f3f4f6').rect(col1 - 5, y - 3, col3 + colWidth3 - col1 + 10, 18).fill()
        doc.restore()
        doc.fillColor('#000000')
      }

      doc.text(item.name, col1, y, { width: colWidth1 })
      doc.text(item.eventTitle, col2, y, { width: colWidth2 })
      doc.text(item.date, col3, y, { width: colWidth3 })

      doc.moveDown(0.8)
      rowIndex++
    }

    // Footer
    doc.moveDown(2)
    doc.fontSize(9).fillColor('#6b7280')
    doc.text(`Gesamt: ${exemptions.length} Freistellung${exemptions.length !== 1 ? 'en' : ''}`, col1)

    doc.end()

    // Wait for PDF to be fully generated
    return new Promise<NextResponse>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks)

        resolve(new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Freistellungen_${airline.name.replace(/[^a-zA-Z0-9]/g, '_')}_${month || new Date().toISOString().split('T')[0]}.pdf"`,
            'Content-Length': pdfBuffer.length.toString(),
          },
        }))
      })
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Fehler bei der PDF-Generierung' }, { status: 500 })
  }
}
