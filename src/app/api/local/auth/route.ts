import { NextResponse } from 'next/server'

// Dead code — the local-mock-mode auth system this route served has been
// fully replaced by real Supabase Auth. Permanently disabled (not just
// env-gated) so a stray NEXT_PUBLIC_LOCAL_MODE=true in production could
// never re-enable it. Left in place only because this file can't be
// deleted on this mount — safe to delete by hand later.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
