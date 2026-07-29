import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCallerRole } from '@/lib/server-auth'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  // Accept any authenticated user (guest judges, admin, etc.)
  const role = await getCallerRole()
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { eventId, judgeNumber, judgeName, slotNumber, entryIndex, criteriaScores, judgeTotal } = await request.json()

  if (!eventId || !judgeNumber || !judgeName || !slotNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = adminClient()

  // If this slot/entry was already locked by an admin (see set-entry-lock),
  // reject the write instead of silently overwriting a frozen mark — a
  // judge's debounced auto-save can otherwise land after a lock and
  // change a score the admin believes is final.
  const { data: existing } = await admin
    .from('guest_marks')
    .select('locked')
    .eq('event_id', eventId)
    .eq('judge_number', judgeNumber)
    .eq('slot_number', slotNumber)
    .eq('entry_index', entryIndex ?? 1)
    .maybeSingle()
  if (existing?.locked) {
    return NextResponse.json({ error: 'This entry is locked and can no longer be edited.' }, { status: 409 })
  }

  const { error } = await admin.from('guest_marks').upsert({
    event_id: eventId,
    judge_number: judgeNumber,
    judge_name: judgeName,
    slot_number: slotNumber,
    entry_index: entryIndex ?? 1,
    criteria_scores: criteriaScores,
    judge_total: judgeTotal,
  }, { onConflict: 'event_id,judge_number,slot_number,entry_index' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
