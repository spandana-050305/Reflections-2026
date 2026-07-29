import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function slugifyLoginId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._-]/g, '').trim()
}

/**
 * POST — public self-registration for club members / final years.
 * Creates the auth user AND the club_accounts row atomically via service role.
 * If the club_accounts insert fails, the auth user is rolled back so no
 * orphaned auth user (which would bypass the approval gate) can exist.
 * Body: { name, loginId, password, role }
 */
export async function POST(req: Request) {
  const { name, loginId, password, role } = await req.json()

  const slug = slugifyLoginId(loginId ?? '')
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!slug) return NextResponse.json({ error: 'Invalid login ID.' }, { status: 400 })
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }
  if (role !== 'club_member' && role !== 'final_year') {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
  }

  const email = `${slug}@reflections.in`
  const admin = adminClient()

  // Reject duplicate login IDs early (club_accounts is the source of truth)
  const { data: existing } = await admin
    .from('club_accounts')
    .select('id')
    .eq('login_id', slug)
    .limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: `Login ID "${slug}" is already taken.` }, { status: 409 })
  }

  // Create the auth user (pre-confirmed; access is gated by approval status)
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
    app_metadata: { role },
  })
  if (authErr) {
    const msg = authErr.message.includes('already')
      ? `Login ID "${slug}" is already taken.`
      : authErr.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Create the club_accounts row — roll back the auth user on failure so an
  // orphaned auth user can never bypass the approval gate.
  const { error: dbErr } = await admin.from('club_accounts').insert({
    name: name.trim(),
    login_id: slug,
    email,
    role,
    status: 'pending',
    user_id: created.user.id,
    created_at: new Date().toISOString(),
  })
  if (dbErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: `Registration failed: ${dbErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
