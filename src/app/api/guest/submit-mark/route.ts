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
