import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Service-role client — bypasses RLS, can create pre-confirmed users
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Verify the calling user is final_year before doing anything
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

// GET — list all guest credentials (service role; RLS-independent)
export async function GET() {
  const role = await getCallerRole()
  if (role !== 'final_year' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = adminClient()
  const { data, error } = await admin.from('guest_credentials').select('*').order('login_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ credentials: data ?? [] })
}

export async function POST(req: NextRequest) {
  // Only final_year admins may call this
  const role = await getCallerRole()
  if (role !== 'final_year' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { email, password, loginId } = await req.json()
  if (!email || !password || !loginId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const admin = adminClient()

  // Create a pre-confirmed Supabase Auth user with role=guest
  const { data, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,          // pre-confirmed — no email needed
    user_metadata: { role: 'guest' },
  })

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 })
  }

  // Store credentials in DB so admin can view/share them
  const { error: dbErr } = await admin.from('guest_credentials').insert({
    login_id: loginId,
    email,
    password_plain: password,
    auth_user_id: data.user.id,
  })

  if (dbErr) {
    // Roll back the auth user if DB insert fails
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: dbErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'final_year' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { email, credId } = await req.json()
  if (!email || !credId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const admin = adminClient()

  // Prefer the stored auth_user_id; fall back to listUsers for legacy rows
  const { data: credRow } = await admin.from('guest_credentials').select('auth_user_id').eq('id', credId).maybeSingle()
  if (credRow?.auth_user_id) {
    await admin.auth.admin.deleteUser(credRow.auth_user_id)
  } else {
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers()
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
    const authUser = listData.users.find((u: any) => u.email === email)
    if (authUser) await admin.auth.admin.deleteUser(authUser.id)
  }

  // Delete from guest_credentials table
  await admin.from('guest_credentials').delete().eq('id', credId)

  return NextResponse.json({ ok: true })
}
