import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getRole } from '@/lib/auth-role'

type CallerUser = {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
  app_metadata?: Record<string, unknown> | null
} & Record<string, unknown>

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Fetches the currently authenticated caller (server-side, via cookies).
export async function getCallerUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Resolves the caller's role for API-route authorization, mirroring the
// approval-status gate that admin/layout.tsx and club/layout.tsx already
// enforce at the page level. Without this, a self-registered final_year /
// club_member account that is still 'pending' (or 'rejected') could bypass
// the blocked dashboard UI and hit privileged API routes directly.
export async function getCallerRole(callerUser?: CallerUser | null): Promise<string | null> {
  const user = callerUser === undefined ? await getCallerUser() : callerUser
  const role = getRole(user)
  if (!role) return null

  if (role !== 'final_year' && role !== 'club_member') return role

  // Self-registered final_year/club_member accounts need approval.
  // Seeded/admin-created accounts have no club_accounts row → allowed through.
  // Uses service role so RLS can never hide the row and bypass this gate.
  const admin = adminClient()
  const { data: acct } = await admin
    .from('club_accounts')
    .select('status')
    .eq('email', user?.email)
    .limit(1)
  const account = (acct ?? [])[0]
  if (account && account.status !== 'approved') return null

  return role
}
