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
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role ?? null
}

// Lock or unlock all guest_marks rows for a given event+slot+entry
export async function POST(request: Request) {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { eventId, slot, entry, locked, rows } = await request.json()
  if (!eventId || slot == null || entry == null || locked == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 })
  }

  const admin = adminClient()
  for (const r of rows) {
    const { error } = await admin.from('guest_marks').upsert({
      event_id: eventId,
      judge_number: r.judge_number,
      judge_name: r.judge_name,
      slot_number: slot,
      entry_index: entry,
      criteria_scores: r.criteria_scores,
      judge_total: r.judge_total,
      locked,
    }, { onConflict: 'event_id,judge_number,slot_number,entry_index' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Full unlock: unlock all marks + delete result for an event
export async function DELETE(request: Request) {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { eventId, allRows } = await request.json()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const admin = adminClient()

  // Unlock all rows
  for (const r of (allRows ?? [])) {
    await admin.from('guest_marks').upsert({
      event_id: eventId,
      judge_number: r.judge_number,
      judge_name: r.judge_name,
      slot_number: r.slot_number,
      entry_index: r.entry_index,
      criteria_scores: r.criteria_scores,
      judge_total: r.judge_total,
      locked: false,
    }, { onConflict: 'event_id,judge_number,slot_number,entry_index' })
  }

  // Delete result
  await admin.from('results').delete().eq('event_id', eventId)

  return NextResponse.json({ ok: true })
}
