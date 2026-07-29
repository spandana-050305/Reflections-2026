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

// GET: return distinct (event_id, judge_number, judge_name) for all events (used by judge tracker)
export async function GET() {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = adminClient()
  const { data, error } = await admin
    .from('guest_marks')
    .select('event_id, judge_number, judge_name')
    .order('judge_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data ?? [] })
}

export async function POST(request: Request) {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

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
      .order('slot_number').order('entry_index').order('member_index'),
  ])

  return NextResponse.json({ marks: gm ?? [], manualMarks: mm ?? [], participants: parts ?? [] })
}
