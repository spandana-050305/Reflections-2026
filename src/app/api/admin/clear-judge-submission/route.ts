import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function DELETE(request: Request) {
  // Auth check
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = user.user_metadata?.role as string | undefined
  if (role !== 'final_year' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { eventId, judgeNumber } = await request.json()
  if (!eventId || !judgeNumber) {
    return NextResponse.json({ error: 'eventId and judgeNumber are required' }, { status: 400 })
  }

  const admin = adminClient()
  const { error } = await admin
    .from('guest_marks')
    .delete()
    .eq('event_id', eventId)
    .eq('judge_number', judgeNumber)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
