// ─── Local development credentials ───────────────────────────
// Only used when NEXT_PUBLIC_LOCAL_MODE=true
// Replace with real Supabase when going live.

export interface LocalUser {
  id: string
  email: string
  user_metadata: {
    role: 'school' | 'club_member' | 'final_year' | 'guest'
    slot_number?: number
  }
}

export const LOCAL_USERS: Record<string, { password: string; user: LocalUser }> = {
  'admin@reflections.in': {
    password: 'admin123',
    user: {
      id: 'local-final-year',
      email: 'admin@reflections.in',
      user_metadata: { role: 'final_year' },
    },
  },
  'club@reflections.in': {
    password: 'club123',
    user: {
      id: 'local-club-member',
      email: 'club@reflections.in',
      user_metadata: { role: 'club_member' },
    },
  },
  'slot1@reflections.in': {
    password: 'slot123',
    user: {
      id: 'local-school-1',
      email: 'slot1@reflections.in',
      user_metadata: { role: 'school', slot_number: 1 },
    },
  },
  'slot2@reflections.in': {
    password: 'slot123',
    user: {
      id: 'local-school-2',
      email: 'slot2@reflections.in',
      user_metadata: { role: 'school', slot_number: 2 },
    },
  },
  'slot3@reflections.in': {
    password: 'slot123',
    user: {
      id: 'local-school-3',
      email: 'slot3@reflections.in',
      user_metadata: { role: 'school', slot_number: 3 },
    },
  },
}

export const SESSION_COOKIE = 'reflections_local_session'

export function localLogin(email: string, password: string): LocalUser | null {
  const entry = LOCAL_USERS[email.toLowerCase()]
  if (!entry || entry.password !== password) return null
  return entry.user
}
