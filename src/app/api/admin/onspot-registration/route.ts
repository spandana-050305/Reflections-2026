import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authCheck() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = user.user_metadata?.role as string | undefined
  if (role !== 'final_year' && role !== 'super_admin' && role !== 'club_member') return null
  return user
}

export async function POST(request: Request) {
  if (!await authCheck()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slotNumber, eventId, participantName, amountPaid, entryIndex } = await request.json()
  if (!slotNumber || !eventId || !participantName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: inserted, error: onspotErr } = await admin
    .from('onspot_registrations')
    .insert({
      slot_number: slotNumber,
      event_id: eventId,
      participant_name: participantName,
      amount_paid: amountPaid ?? false,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (onspotErr) return NextResponse.json({ error: onspotErr.message }, { status: 500 })

  const { error: partErr } = await admin.from('participants').insert({
    slot_number: slotNumber,
    event_id: eventId,
    participant_name: participantName,
    entry_index: entryIndex,
    member_index: 1,
    created_at: new Date().toISOString(),
  })

  if (partErr) {
    await admin.from('onspot_registrations').delete().eq('id', inserted.id)
    return NextResponse.json({ error: partErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: inserted.id })
}

export async function PATCH(request: Request) {
  if (!await authCheck()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { onspotId, amountPaid } = await request.json()
  const admin = adminClient()
  const { error } = await admin.from('onspot_registrations').update({ amount_paid: amountPaid }).eq('id', onspotId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  if (!await authCheck()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { onspotId, slotNumber, eventId, participantName, entryIndex } = await request.json()
  const admin = adminClient()

  await admin.from('onspot_registrations').delete().eq('id', onspotId)
  await admin.from('participants')
    .delete()
    .eq('slot_number', slotNumber)
    .eq('event_id', eventId)
    .eq('participant_name', participantName)
    .eq('entry_index', entryIndex ?? 1)
    .eq('member_index', 1)

  return NextResponse.json({ ok: true })
}
