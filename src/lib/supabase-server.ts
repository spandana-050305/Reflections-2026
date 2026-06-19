// Local-only mode — no Supabase connection needed.
// Returns the file-backed mock client for all server-side usage.
import { cookies } from 'next/headers'
import { createMockServerClient } from './mock-client.server'
import { SESSION_COOKIE } from './local-auth'

export function createClient() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value
  return createMockServerClient(sessionCookie) as any
}
