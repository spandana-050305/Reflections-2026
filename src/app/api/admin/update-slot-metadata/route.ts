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

// POST body: { updates: [{ userId: string, slotNumber: number }] }
export async function POST(req: NextRequest) {
  const role = await getCallerRole()
  if (role !== 'final_year' && role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { updates } = await req.json() as { updates: { userId: string; slotNumber: number }[] }
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'Missing updates array' }, { status: 400 })
  }

  const admin = adminClient()
  const errors: string[] = []

  for (const { userId, slotNumber } of updates) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { slot_number: slotNumber },
    })
    if (error) errors.push(`${userId}: ${error.message}`)
  }

  if (errors.length > 0) return NextResponse.json({ ok: false, errors }, { status: 500 })
  return NextResponse.json({ ok: true })
}
