import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCallerUser } from '@/lib/server-auth'
import { getRole } from '@/lib/auth-role'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — latest 200 activity log entries (service role; RLS-independent)
export async function GET() {
  const caller = await getCallerUser()
  if (getRole(caller) !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = adminClient()
  const { data, error } = await admin
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}
