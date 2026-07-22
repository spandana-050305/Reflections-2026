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

// GET — list all auth users
export async function GET() {
  const role = await getCallerRole()
  if (role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = adminClient()
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = data.users.map((u: any) => ({
    id: u.id,
    email: u.email,
    role: u.user_metadata?.role ?? 'unknown',
    name: u.user_metadata?.name ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }))

  return NextResponse.json({ users })
}

// POST — reset any user's password
export async function POST(req: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { userId, newPassword } = await req.json()
  if (!userId || !newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: 'Missing userId or password (min 4 chars)' }, { status: 400 })
  }

  const admin = adminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
    email_confirm: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — delete any user by userId
export async function DELETE(req: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const admin = adminClient()

  // Also clean up club_accounts row if it exists
  await admin.from('club_accounts').delete().eq('user_id', userId)

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
