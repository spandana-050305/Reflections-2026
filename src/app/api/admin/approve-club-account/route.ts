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
  if (role !== 'final_year' && role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { accountId, userId } = await req.json()
  if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })

  const admin = adminClient()

  // Confirm email in Supabase Auth if we have the userId
  if (userId) {
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  // Update club_accounts status to approved
  const { error: dbErr } = await admin
    .from('club_accounts')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', accountId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
