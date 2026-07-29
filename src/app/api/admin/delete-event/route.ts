import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCallerRole } from '@/lib/server-auth'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authCheck() {
  const role = await getCallerRole()
  if (role !== 'final_year' && role !== 'super_admin') return null
  return role
}

// Create or update an event
export async function POST(request: Request) {
  if (!await authCheck()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId, payload } = await request.json()
  const admin = adminClient()

  if (eventId) {
    const { error } = await admin.from('events').update(payload).eq('id', eventId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await admin.from('events').insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Delete an event and all related data
export async function DELETE(request: Request) {
  if (!await authCheck()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId } = await request.json()
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const admin = adminClient()
  const cascadeResults = await Promise.all([
    admin.from('participants').delete().eq('event_id', eventId),
    admin.from('marks').delete().eq('event_id', eventId),
    admin.from('guest_marks').delete().eq('event_id', eventId),
    admin.from('results').delete().eq('event_id', eventId),
    admin.from('onspot_registrations').delete().eq('event_id', eventId),
  ])
  const cascadeError = cascadeResults.find(r => r.error)?.error
  if (cascadeError) return NextResponse.json({ error: `Cascade delete failed: ${cascadeError.message}` }, { status: 500 })

  const { error } = await admin.from('events').delete().eq('id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
