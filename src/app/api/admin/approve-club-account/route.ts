import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { accountId, userId } = await req.json()
  if (!accountId || !userId) return NextResponse.json({ error: 'Missing accountId or userId' }, { status: 400 })

  const admin = adminClient()

  // Confirm email in Supabase Auth so the user can log in
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  // Update club_accounts status to approved
  const { error: dbErr } = await admin
    .from('club_accounts')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', accountId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
