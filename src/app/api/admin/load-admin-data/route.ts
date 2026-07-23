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
 * POST: load various admin data via service role.
 * Body: { tables: string[] } — any subset of:
 *   'marks', 'results', 'participants', 'onspot_registrations', 'schools', 'categories', 'events', 'settings'
 * Returns an object keyed by table name.
 */
export async function POST(request: Request) {
  const role = await getCallerRole()
  if (!role || !['final_year', 'super_admin', 'club_member'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { tables } = await request.json()
  if (!Array.isArray(tables) || tables.length === 0) {
    return NextResponse.json({ error: 'tables must be a non-empty array' }, { status: 400 })
  }

  const ALLOWED_TABLES = ['marks', 'results', 'participants', 'onspot_registrations', 'schools', 'categories', 'events', 'settings']
  const requested = tables.filter(t => ALLOWED_TABLES.includes(t))
  if (requested.length === 0) {
    return NextResponse.json({ error: 'No valid tables requested' }, { status: 400 })
  }

  const admin = adminClient()
  const out: Record<string, any[]> = {}

  await Promise.all(requested.map(async (table) => {
    let q = admin.from(table).select('*')
    if (table === 'schools') q = admin.from(table).select('slot_number, school_name').order('slot_number') as any
    if (table === 'categories') q = admin.from(table).select('*').order('display_order') as any
    if (table === 'events') q = admin.from(table).select('*').order('name') as any
    if (table === 'participants') q = admin.from(table).select('*').order('slot_number').order('entry_index').order('member_index') as any
    if (table === 'onspot_registrations') q = admin.from(table).select('*').order('created_at', { ascending: false }) as any
    if (table === 'marks') q = admin.from(table).select('event_id, slot_number, entry_index, total') as any
    const { data, error } = await q
    out[table] = error ? [] : (data ?? [])
  }))

  return NextResponse.json(out)
}
