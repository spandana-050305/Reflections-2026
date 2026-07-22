import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function DELETE(request: Request) {
  // Auth check
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = user.user_metadata?.role as string | undefined
  if (role !== 'final_year' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { eventId } = await request.json()
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const admin = adminClient()

  // Delete related data first
  await Promise.all([
    admin.from('participants').delete().eq('event_id', eventId),
    admin.from('marks').delete().eq('event_id', eventId),
    admin.from('guest_marks').delete().eq('event_id', eventId),
    admin.from('results').delete().eq('event_id', eventId),
  ])

  const { error } = await admin.from('events').delete().eq('id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
