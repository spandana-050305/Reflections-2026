import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  const { eventIds } = await request.json()
  if (!eventIds?.length) return NextResponse.json({ marks: [], manualMarks: [], participants: [] })

  const admin = adminClient()
  const [
    { data: gm },
    { data: mm },
    { data: parts },
  ] = await Promise.all([
    admin.from('guest_marks').select('*').in('event_id', eventIds),
    admin.from('marks').select('*').in('event_id', eventIds),
    admin.from('participants')
      .select('slot_number, event_id, entry_index, member_index, participant_name')
      .in('event_id', eventIds)
      .order('entry_index').order('member_index'),
  ])

  return NextResponse.json({ marks: gm ?? [], manualMarks: mm ?? [], participants: parts ?? [] })
}
