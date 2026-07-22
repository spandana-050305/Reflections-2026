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

async function getCaller() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET — list all auth users
export async function GET() {
  const caller = await getCaller()
  if (caller?.user_metadata?.role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = adminClient()
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = data.users.map((u: any) => ({
    id: u.id,
    email: u.email,
    role: u.user_metadata?.role ?? 'unknown',
    banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
  }))

  return NextResponse.json({ users })
}

// POST — reset password | change role | suspend | unsuspend | force_logout
export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (caller?.user_metadata?.role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json()
  const { action, userId, targetEmail } = body
  const admin = adminClient()

  if (action === 'reset_password') {
    const { newPassword } = body
    if (!userId || !newPassword || newPassword.length < 4)
      return NextResponse.json({ error: 'Missing userId or password (min 4 chars)' }, { status: 400 })
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword, email_confirm: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logActivity({ action: 'reset_password', actorEmail: caller.email, actorRole: 'super_admin', targetEmail, targetId: userId })
    return NextResponse.json({ ok: true })
  }

  if (action === 'change_role') {
    const { newRole } = body
    const allowed = ['club_member', 'final_year', 'school', 'guest']
    if (!userId || !allowed.includes(newRole))
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: { role: newRole } })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Also update club_accounts if applicable
    if (newRole === 'final_year' || newRole === 'club_member') {
      await admin.from('club_accounts').update({ role: newRole }).eq('user_id', userId)
    }
    await logActivity({ action: 'change_role', actorEmail: caller.email, actorRole: 'super_admin', targetEmail, targetId: userId, details: `→ ${newRole}` })
    return NextResponse.json({ ok: true })
  }

  if (action === 'suspend') {
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    // Ban for 100 years — effectively permanent until manually unsuspended
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876600h' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logActivity({ action: 'suspend_user', actorEmail: caller.email, actorRole: 'super_admin', targetEmail, targetId: userId })
    return NextResponse.json({ ok: true })
  }

  if (action === 'unsuspend') {
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logActivity({ action: 'unsuspend_user', actorEmail: caller.email, actorRole: 'super_admin', targetEmail, targetId: userId })
    return NextResponse.json({ ok: true })
  }

  if (action === 'force_logout') {
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    // Ban briefly then immediately unban — invalidates all active sessions
    await admin.auth.admin.updateUserById(userId, { ban_duration: '1s' })
    await new Promise(r => setTimeout(r, 1100))
    await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    await logActivity({ action: 'force_logout', actorEmail: caller.email, actorRole: 'super_admin', targetEmail, targetId: userId })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// DELETE — delete any user
export async function DELETE(req: NextRequest) {
  const caller = await getCaller()
  if (caller?.user_metadata?.role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { userId, targetEmail } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const admin = adminClient()
  await admin.from('club_accounts').delete().eq('user_id', userId)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity({ action: 'delete_user', actorEmail: caller.email, actorRole: 'super_admin', targetEmail, targetId: userId })
  return NextResponse.json({ ok: true })
}
