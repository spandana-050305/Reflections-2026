import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity-log'
import { getCallerRole, getCallerUser } from '@/lib/server-auth'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function PATCH(request: Request) {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { eventId, published } = await request.json()
  if (!eventId || published == null) {
    return NextResponse.json({ error: 'Missing eventId or published' }, { status: 400 })
  }

  const admin = adminClient()
  const { error } = await admin
    .from('results')
    .update({ published })
    .eq('event_id', eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const caller = await getCallerUser()
  const { data: ev } = await admin.from('events').select('name').eq('id', eventId).maybeSingle()
  await logActivity({
    action: published ? 'publish_result' : 'unpublish_result',
    actorEmail: caller?.email,
    actorRole: role,
    targetId: eventId,
    details: ev?.name ?? eventId,
  })

  return NextResponse.json({ ok: true })
}
