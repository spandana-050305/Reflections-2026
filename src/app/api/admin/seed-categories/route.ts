import { NextResponse } from 'next/server'
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
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role ?? null
}

/**
 * POST: Ensure A/B/C/D categories exist (inserts missing ones), returns full category list.
 */
export async function POST(_request: Request) {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = adminClient()

  // Fetch existing categories
  const { data: existing, error: fetchErr } = await admin
    .from('categories')
    .select('*')
    .order('display_order')

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const existingNames = new Set((existing ?? []).map((c: any) => c.name))
  const DEFAULTS = ['A', 'B', 'C', 'D']
  const missing = DEFAULTS.filter(n => !existingNames.has(n))

  if (missing.length > 0) {
    await admin.from('categories').insert(
      missing.map(n => ({ name: n, display_order: DEFAULTS.indexOf(n) + 1 }))
    )
    // Re-fetch after insert
    const { data: fresh } = await admin.from('categories').select('*').order('display_order')
    return NextResponse.json({ categories: fresh ?? existing ?? [] })
  }

  return NextResponse.json({ categories: existing ?? [] })
}
