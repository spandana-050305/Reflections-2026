import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')
  const judgeNumber = searchParams.get('judgeNumber')

  if (!eventId || !judgeNumber) {
    return NextResponse.json({ error: 'Missing eventId or judgeNumber' }, { status: 400 })
  }

  const admin = adminClient()
  const { data, error } = await admin
    .from('guest_marks')
    .select('*')
    .eq('event_id', eventId)
    .eq('judge_number', Number(judgeNumber))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ marks: data ?? [] })
}
