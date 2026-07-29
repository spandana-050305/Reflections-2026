import { NextResponse } from 'next/server'

// Dead code — arbitrary local-mock-mode query executor, gated only by
// NEXT_PUBLIC_LOCAL_MODE. Permanently disabled so a stray env var flip in
// production could never re-enable it. Left in place only because this
// file can't be deleted on this mount — safe to delete by hand later.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
