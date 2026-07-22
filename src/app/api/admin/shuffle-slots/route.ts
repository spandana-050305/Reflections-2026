import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: Request) {
  // Auth check
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = user.user_metadata?.role as string | undefined
  if (role !== 'final_year' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = adminClient()

  // Load all schools with slot numbers
  const { data: schools, error: schoolsErr } = await admin
    .from('schools')
    .select('id, slot_number, user_id')
    .not('slot_number', 'is', null)
  if (schoolsErr) return NextResponse.json({ error: schoolsErr.message }, { status: 500 })
  if (!schools || schools.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 schools with slot numbers to shuffle.' }, { status: 400 })
  }

  // Clear all computed results (slot references would be wrong after shuffle)
  await admin.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Fisher-Yates shuffle
  const oldSlots = schools.map(s => s.slot_number as number)
  const newSlots = [...oldSlots]
  for (let i = newSlots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newSlots[i], newSlots[j]] = [newSlots[j], newSlots[i]]
  }

  // Phase 1: move to temp slots to avoid conflicts
  for (let i = 0; i < schools.length; i++) {
    const tempSlot = oldSlots[i] + 10000
    const results = await Promise.all([
      admin.from('schools').update({ slot_number: tempSlot }).eq('id', schools[i].id),
      admin.from('participants').update({ slot_number: tempSlot }).eq('slot_number', oldSlots[i]),
      admin.from('marks').update({ slot_number: tempSlot }).eq('slot_number', oldSlots[i]),
      admin.from('guest_marks').update({ slot_number: tempSlot }).eq('slot_number', oldSlots[i]),
      admin.from('onspot_registrations').update({ slot_number: tempSlot }).eq('slot_number', oldSlots[i]),
    ])
    const firstErr = results.find(r => r.error)?.error
    if (firstErr) return NextResponse.json({ error: `Phase 1 failed: ${firstErr.message}` }, { status: 500 })
  }

  // Phase 2: move from temp to new slots
  for (let i = 0; i < schools.length; i++) {
    const tempSlot = oldSlots[i] + 10000
    const results = await Promise.all([
      admin.from('schools').update({ slot_number: newSlots[i] }).eq('id', schools[i].id),
      admin.from('participants').update({ slot_number: newSlots[i] }).eq('slot_number', tempSlot),
      admin.from('marks').update({ slot_number: newSlots[i] }).eq('slot_number', tempSlot),
      admin.from('guest_marks').update({ slot_number: newSlots[i] }).eq('slot_number', tempSlot),
      admin.from('onspot_registrations').update({ slot_number: newSlots[i] }).eq('slot_number', tempSlot),
    ])
    const firstErr = results.find(r => r.error)?.error
    if (firstErr) return NextResponse.json({ error: `Phase 2 failed: ${firstErr.message}` }, { status: 500 })
  }

  // Update Auth user metadata so schools see their new slot immediately
  const metaUpdates = schools
    .map((s, i) => s.user_id ? { userId: s.user_id, slotNumber: newSlots[i] } : null)
    .filter((x): x is { userId: string; slotNumber: number } => x !== null)

  if (metaUpdates.length > 0) {
    for (const { userId, slotNumber } of metaUpdates) {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { slot_number: slotNumber },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
