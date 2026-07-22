import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'final_year') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { userId, email, newPassword } = await req.json()
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 })
  }

  const admin = adminClient()

  // If we have userId, update directly
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Otherwise find by email
  if (!email) return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 })
  const { data: listData, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
  const authUser = listData.users.find((u: any) => u.email === email)
  if (!authUser) return NextResponse.json({ error: 'Auth user not found — they may need to re-register' }, { status: 404 })

  const { error } = await admin.auth.admin.updateUserById(authUser.id, {
    password: newPassword,
    email_confirm: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
