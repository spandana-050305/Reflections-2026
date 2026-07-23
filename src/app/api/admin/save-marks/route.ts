import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getCallerRole(): Promise<string | null> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role ?? null
}

// POST: replace all marks for an event (delete + insert atomically via RPC, or fallback)
export async function POST(request: Request) {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { eventId, rows } = await request.json()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const admin = adminClient()

  // Delete existing marks for this event
  const { error: delErr } = await admin.from('marks').delete().eq('event_id', eventId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // Insert new marks if any
  if (rows && rows.length > 0) {
    const { error: insErr } = await admin.from('marks').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE: clear all marks + result for an event
export async function DELETE(request: Request) {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { eventId } = await request.json()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const admin = adminClient()
  const { error: delMarks } = await admin.from('marks').delete().eq('event_id', eventId)
  if (delMarks) return NextResponse.json({ error: delMarks.message }, { status: 500 })
  const { error: delResults } = await admin.from('results').delete().eq('event_id', eventId)
  if (delResults) return NextResponse.json({ error: delResults.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
