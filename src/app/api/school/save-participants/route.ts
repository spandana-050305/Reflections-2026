import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCallerUser } from '@/lib/server-auth'
import { getRole, getSlotNumber } from '@/lib/auth-role'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getCallerSchool(): Promise<{ role: string; slotNumber: number } | null> {
  const user = await getCallerUser()
  if (!user) return null
  const role = getRole(user)
  const slotNumber = getSlotNumber(user)
  if (role !== 'school' || !slotNumber) return null
  return { role, slotNumber }
}

/**
 * POST: Replace all participants for the caller's slot + given eventId.
 * Schools can only write for their own slot_number (enforced server-side).
 * Body: { eventId: string, rows: { slot_number, event_id, participant_name, entry_index, member_index }[] }
 */
export async function POST(request: Request) {
  const caller = await getCallerSchool()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { eventId, rows } = await request.json()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  // Validate all rows belong to the caller's own slot
  if (rows && rows.length > 0) {
    const invalid = rows.some((r: any) => r.slot_number !== caller.slotNumber)
    if (invalid) {
      return NextResponse.json({ error: 'Rows must belong to your own slot' }, { status: 403 })
    }
  }

  const admin = adminClient()

  // Delete existing entries for this school+event
  const { error: delErr } = await admin
    .from('participants')
    .delete()
    .eq('event_id', eventId)
    .eq('slot_number', caller.slotNumber)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // Insert new rows if any
  if (rows && rows.length > 0) {
    const { error: insErr } = await admin.from('participants').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
