// ─── Server mock client ───────────────────────────────────────
// Reads & writes the shared file-backed store directly. Auth user is
// taken from the session cookie value passed in by supabase-server.ts.

import { MockQuery, type Executor } from './mock-query'
import { executeQuery, signInUser, signUpUser } from './local-store.server'
import type { LocalUser } from './local-auth'

const serverExecutor: Executor = async (descriptor) => executeQuery(descriptor)

export function createMockServerClient(sessionJson: string | undefined) {
  let user: LocalUser | null = null
  try {
    if (sessionJson) user = JSON.parse(decodeURIComponent(sessionJson))
  } catch {}

  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const { user: u, error } = signInUser(email, password)
        return { data: { user: u }, error }
      },
      signOut: async () => ({ error: null }),
      signUp: async (args: { email: string; password: string; options?: { data?: any } }) => {
        const { user: u, error } = signUpUser(args.email, args.password, args.options?.data ?? {})
        return { data: { user: u }, error }
      },
    },
    from: (table: string) => new MockQuery(table, serverExecutor),
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '#' } }),
      }),
    },
  }
}
