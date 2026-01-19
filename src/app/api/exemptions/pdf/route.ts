import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PDFDocument from 'pdfkit'

// Aviation Clarity Design System Colors
const COLORS = {
  navy: '#001a3f',
  lime: '#c4d82e',
  lightGray: '#f8fafc',
  mediumGray: '#94a3b8',
  darkGray: '#475569',
  white: '#ffffff',
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // Get user profile for authorization check
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('role, airline_id')
    .eq('id', user.id)
    .single()

  // Get airline_id and month from query params
  const airlineId = request.nextUrl.searchParams.get('airline_id')
  const month = request.nextUrl.searchParams.get('month') // Format: YYYY-MM
  if (!airlineId) {
    return NextResponse.json({ error: 'Airline ID fehlt' }, { status: 400 })
  }

  // Authorization: User muss Admin sein ODER zur Airline gehören
  const isAdmin = (userProfile as any)?.role === 'admin'
  const belongsToAirline = (userProfile as any)?.airline_id === airlineId

  if (!isAdmin && !belongsToAirline) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Airline' }, { status: 403 })
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

    // Generate PDF with Aviation Clarity Design
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Freistellungen - ${airline.name}${monthLabel ? ` - ${monthLabel}` : ''}`,
        Author: 'jVC Terminverwaltung',
      }
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))

    const pageWidth = doc.page.width
    const contentWidth = pageWidth - 100 // 50px margins on each side

    // ===== HEADER SECTION =====

    // Lime accent line at top
    doc.save()
    doc.fillColor(COLORS.lime).rect(0, 0, pageWidth, 4).fill()
    doc.restore()

    // Title
    doc.moveDown(2)
    doc.fontSize(32).font('Helvetica-Bold').fillColor(COLORS.navy)
    doc.text('FREISTELLUNGEN', { align: 'center' })

    // Airline name with letter spacing
    doc.moveDown(0.4)
    doc.fontSize(14).font('Helvetica').fillColor(COLORS.darkGray)
    doc.text(airline.name.toUpperCase(), { align: 'center', characterSpacing: 3 })

    // Month label
    if (monthLabel) {
      doc.moveDown(0.6)
      doc.fontSize(12).fillColor(COLORS.darkGray)
      doc.text(monthLabel, { align: 'center' })
    }

    // Creation date
    doc.moveDown(0.4)
    doc.fontSize(9).fillColor(COLORS.mediumGray)
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, { align: 'center' })

    // Navy separator line
    doc.moveDown(1.5)
    const separatorY = doc.y
    doc.save()
    doc.strokeColor(COLORS.navy).lineWidth(1)
    doc.moveTo(50, separatorY).lineTo(pageWidth - 50, separatorY).stroke()
    doc.restore()
    doc.moveDown(2)

    // ===== TABLE SECTION =====

    // Column definitions
    const col1 = 55 // Leave room for lime accent
    const col2 = 200
    const col3 = 390
    const colWidth1 = 140
    const colWidth2 = 185
    const colWidth3 = 115
    const rowHeight = 22

    // Table header with navy background
    const tableHeaderY = doc.y
    doc.save()
    doc.fillColor(COLORS.navy).rect(50, tableHeaderY - 6, contentWidth, 28).fill()
    doc.restore()

    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white)
    doc.text('NAME', col1, tableHeaderY, { width: colWidth1 })
    doc.text('TERMIN', col2, tableHeaderY, { width: colWidth2 })
    doc.text('DATUM', col3, tableHeaderY, { width: colWidth3 })

    doc.y = tableHeaderY + 32

    // Table rows
    doc.font('Helvetica').fontSize(10)
    let rowIndex = 0

    for (const item of exemptions) {
      const y = doc.y

      // Check if we need a new page
      if (y > doc.page.height - 80) {
        doc.addPage()

        // Lime accent at top of new page
        doc.save()
        doc.fillColor(COLORS.lime).rect(0, 0, pageWidth, 4).fill()
        doc.restore()

        doc.y = 60
        rowIndex = 0

        // Repeat table header on new page
        const newHeaderY = doc.y
        doc.save()
        doc.fillColor(COLORS.navy).rect(50, newHeaderY - 6, contentWidth, 28).fill()
        doc.restore()

        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white)
        doc.text('NAME', col1, newHeaderY, { width: colWidth1 })
        doc.text('TERMIN', col2, newHeaderY, { width: colWidth2 })
        doc.text('DATUM', col3, newHeaderY, { width: colWidth3 })

        doc.y = newHeaderY + 32
        doc.font('Helvetica').fontSize(10)
      }

      const currentY = doc.y

      // Zebra striping (very subtle)
      if (rowIndex % 2 === 0) {
        doc.save()
        doc.fillColor(COLORS.lightGray).rect(50, currentY - 4, contentWidth, rowHeight).fill()
        doc.restore()
      }

      // Lime accent line on left
      doc.save()
      doc.fillColor(COLORS.lime).rect(50, currentY - 4, 3, rowHeight).fill()
      doc.restore()

      // Row content
      doc.fillColor(COLORS.navy)
      doc.text(item.name, col1, currentY, { width: colWidth1, ellipsis: true })
      doc.text(item.eventTitle, col2, currentY, { width: colWidth2, ellipsis: true })
      doc.text(item.date, col3, currentY, { width: colWidth3 })

      doc.y = currentY + rowHeight
      rowIndex++
    }

    // ===== FOOTER SECTION =====

    // Footer line and text at bottom
    const footerY = doc.page.height - 55

    // Lime footer line
    doc.save()
    doc.strokeColor(COLORS.lime).lineWidth(1)
    doc.moveTo(50, footerY).lineTo(pageWidth - 50, footerY).stroke()
    doc.restore()

    // Total count
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.navy)
    doc.text(
      `Gesamt: ${exemptions.length} Freistellung${exemptions.length !== 1 ? 'en' : ''}`,
      50,
      footerY + 12
    )

    // jVC branding (subtle)
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.mediumGray)
    doc.text('jVC Terminverwaltung', pageWidth - 140, footerY + 14)

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
