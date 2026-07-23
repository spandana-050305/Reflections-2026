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

export async function DELETE(req: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'final_year' && role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { accountId, email } = await req.json()
  if (!accountId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = adminClient()

  // Grab user_id before deleting the row
  const { data: acct } = await admin.from('club_accounts').select('user_id').eq('id', accountId).single()
  await admin.from('club_accounts').delete().eq('id', accountId)

  // Delete auth user directly by ID (avoids listing all users)
  if (acct?.user_id) {
    await admin.auth.admin.deleteUser(acct.user_id)
  }

  const caller = await getCallerUser()
  await logActivity({ action: 'delete_club_account', actorEmail: caller?.email, actorRole: role, targetEmail: email, targetId: accountId })

  return NextResponse.json({ ok: true })
}
