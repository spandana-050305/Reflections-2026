import { NextResponse } from 'next/server'

// Dead code — used to dump every local-mock-mode user's email/role/
// participant data with no authentication, gated only by
// NEXT_PUBLIC_LOCAL_MODE. Permanently disabled so a stray env var flip in
// production could never re-enable it. Left in place only because this
// file can't be deleted on this mount — safe to delete by hand later.
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
