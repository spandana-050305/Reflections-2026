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
  if (role !== 'guest' && role !== 'final_year') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { eventId, assignedMembers } = await req.json()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const admin = adminClient()
  const { error } = await admin
    .from('events')
    .update({ assigned_members: assignedMembers ?? null })
    .eq('id', eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
