import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logActivity } from '@/lib/activity-log'

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
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role ?? null
}

async function getCallerUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST — create a school
export async function POST(req: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'final_year' && role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { email, password, schoolName, slotNumber } = await req.json()
  if (!email || !password || !schoolName) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = adminClient()

  const { data, error: authErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role: 'school', slot_number: slotNumber ?? null },
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  const { error: dbErr } = await admin.from('schools').insert({
    user_id: data.user.id, school_name: schoolName,
    slot_number: slotNumber ?? null, email, password_plain: password,
  })
  if (dbErr) {
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: dbErr.message }, { status: 400 })
  }

  const caller = await getCallerUser()
  await logActivity({ action: 'create_school', actorEmail: caller?.email, actorRole: role, targetEmail: email, details: `${schoolName} (slot ${slotNumber ?? 'unassigned'})` })

  return NextResponse.json({ ok: true })
}

// DELETE — remove school auth user + all their data
export async function DELETE(req: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'final_year' && role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { schoolId, userId, slotNumber, schoolName } = await req.json()
  if (!schoolId) return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })

  const admin = adminClient()

  if (slotNumber != null) {
    await admin.from('guest_marks').delete().eq('slot_number', slotNumber)
    await admin.from('marks').delete().eq('slot_number', slotNumber)
    await admin.from('participants').delete().eq('slot_number', slotNumber)
    await admin.from('onspot_registrations').delete().eq('slot_number', slotNumber)
  }

  await admin.from('schools').delete().eq('id', schoolId)
  if (userId) await admin.auth.admin.deleteUser(userId)

  const caller = await getCallerUser()
  await logActivity({ action: 'delete_school', actorEmail: caller?.email, actorRole: role, targetId: schoolId, details: schoolName ?? `slot ${slotNumber}` })

  return NextResponse.json({ ok: true })
}
