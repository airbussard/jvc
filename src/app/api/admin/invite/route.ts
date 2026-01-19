import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase-server'

// Valide Rollen
const VALID_ROLES = ['normal', 'moderator', 'admin'] as const
type ValidRole = typeof VALID_ROLES[number]

// Email-Validierung (RFC 5322 vereinfacht)
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as any).role !== 'admin') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    // Input-Validierung
    let body: { email?: string; name?: string; role?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiges JSON-Format' }, { status: 400 })
    }

    const { email, name, role } = body

    // Email validieren
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })
    }

    // Name validieren
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name muss mindestens 2 Zeichen haben' }, { status: 400 })
    }

    // Rolle validieren (Whitelist!)
    if (!role || !VALID_ROLES.includes(role as ValidRole)) {
      return NextResponse.json({ error: 'Ungültige Rolle. Erlaubt: normal, moderator, admin' }, { status: 400 })
    }

    const serviceRoleClient = await createServiceRoleClient()

    const { data, error } = await serviceRoleClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: name,
        role: role,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Interner Serverfehler' }, { status: 500 })
  }
}