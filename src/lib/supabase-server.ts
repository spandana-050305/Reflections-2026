// Server-side Supabase client (used by server components & route handlers).
//
// Right now the app runs in LOCAL MODE: this returns a file-backed mock
// client and reads the local session cookie.
//
// ─────────────────────────────────────────────────────────────────────
// GOING LIVE WITH SUPABASE (cloud):
//   1. Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
//   2. Uncomment the `createServerClient` import line below.
//   3. Uncomment the "Supabase cloud client" block inside createClient().
//   4. Delete (or comment out) the "Local mode" return at the bottom.
// ─────────────────────────────────────────────────────────────────────

import { cookies } from 'next/headers'
import { createMockServerClient } from './mock-client.server'
import { SESSION_COOKIE } from './local-auth'
// import { createServerClient } from '@supabase/ssr'

export function createClient() {
  const cookieStore = cookies()

  // ─── Supabase cloud client (uncomment to go live) ──────────────────
  // return createServerClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   {
  //     cookies: {
  //       get(name: string) {
  //         return cookieStore.get(name)?.value
  //       },
  //       set(name: string, value: string, options: any) {
  //         try { cookieStore.set({ name, value, ...options }) } catch {}
  //       },
  //       remove(name: string, options: any) {
  //         try { cookieStore.set({ name, value: '', ...options }) } catch {}
  //       },
  //     },
  //   },
  // )

  // ─── Local mode (default) ──────────────────────────────────────────
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value
  return createMockServerClient(sessionCookie) as any
}
