// Browser Supabase client.
//
// Right now the app runs in LOCAL MODE: this returns a file-backed mock
// client so you can demo without any cloud setup.
//
// ─────────────────────────────────────────────────────────────────────
// GOING LIVE WITH SUPABASE (cloud):
//   1. Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
//   2. Uncomment the `createBrowserClient` import line below.
//   3. Uncomment the "Supabase cloud client" block inside createClient().
//   4. Delete (or comment out) the "Local mode" return at the bottom.
// The mock client mimics the Supabase API, so no other code needs to change.
// ─────────────────────────────────────────────────────────────────────

import { createMockBrowserClient } from './mock-client.browser'
// import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // ─── Supabase cloud client (uncomment to go live) ──────────────────
  // return createBrowserClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  // )

  // ─── Local mode (default) ──────────────────────────────────────────
  return createMockBrowserClient() as any
}
