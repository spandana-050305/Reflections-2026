// Browser mock client
// All DB ops go through /api/local/query.
// Auth ops go through /api/local/auth, which also sets the session cookie
// via Set-Cookie header so the browser stores it before the redirect.

import { MockQuery, type Executor } from './mock-query'
import { SESSION_COOKIE } from './local-auth'

const browserExecutor: Executor = async (descriptor) => {
  try {
    const res = await fetch('/api/local/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(descriptor),
    })
    return await res.json()
  } catch (e: any) {
    return { data: null, error: { message: e?.message ?? 'Network error' } }
  }
}

function getSessionUser() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!match) return null
  try { return JSON.parse(decodeURIComponent(match[1])) } catch { return null }
}

const mockStorage = {
  from: (_bucket: string) => ({
    upload: async (path: string) => ({ data: { path }, error: null }),
    getPublicUrl: () => ({ data: { publicUrl: '#' } }),
  }),
}

export function createMockBrowserClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: getSessionUser() }, error: null }),

      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        try {
          const res = await fetch('/api/local/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'signin', email, password }),
          })
          const { user, error } = await res.json()
          if (!user) return { data: { user: null }, error: error ?? { message: 'Invalid credentials' } }
          // The API route already sets the cookie via Set-Cookie response header.
          // Also set via document.cookie as a belt-and-suspenders fallback.
          document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(user))};path=/;max-age=86400;SameSite=Lax`
          return { data: { user }, error: null }
        } catch (e: any) {
          return { data: { user: null }, error: { message: e?.message ?? 'Network error' } }
        }
      },

      signOut: async () => {
        document.cookie = `${SESSION_COOKIE}=;path=/;max-age=0`
        return { error: null }
      },

      signUp: async (args: { email: string; password: string; options?: { data?: any } }) => {
        try {
          const res = await fetch('/api/local/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              action: 'signup',
              email: args.email,
              password: args.password,
              data: args.options?.data ?? {},
            }),
          })
          const { user, error } = await res.json()
          if (!user) return { data: { user: null }, error: error ?? { message: 'Sign-up failed' } }
          return { data: { user }, error: null }
        } catch (e: any) {
          return { data: { user: null }, error: { message: e?.message ?? 'Network error' } }
        }
      },
    },

    from: (table: string) => new MockQuery(table, browserExecutor),
    storage: mockStorage,
  }
}
