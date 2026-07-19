// ─── Pure local query engine ──────────────────────────────────
// Runs Supabase-style queries against a plain JS store object.
// No filesystem / network here — that lives in local-store.server.ts.

import {
  MOCK_CATEGORIES, MOCK_EVENTS, MOCK_SCHOOLS, MOCK_PARTICIPANTS,
  MOCK_MARKS, MOCK_RESULTS, MOCK_ANNOUNCEMENTS, MOCK_SETTINGS, MOCK_ONSPOT,
} from './mock-data'
import { LOCAL_USERS } from './local-auth'

export interface StoreUser {
  id: string
  email: string
  password: string
  role: 'school' | 'club_member' | 'final_year' | 'guest'
  slot_number?: number
}

export interface LocalStore {
  categories: any[]
  events: any[]
  schools: any[]
  participants: any[]
  marks: any[]
  results: any[]
  announcements: any[]
  onspot_registrations: any[]
  guest_credentials: any[]
  guest_marks: any[]
  club_accounts: any[]
  settings: { id: number; registration_open: boolean; points_1st?: number; points_2nd?: number; points_3rd?: number; unlock_password?: string | null; security_answer_1?: string | null; security_answer_2?: string | null }
  users: StoreUser[]
}

export interface QueryDescriptor {
  table: string
  filters: Array<{ col: string; val: any; op: string }>
  orders: Array<{ col: string; asc: boolean }>
  limit?: number
  single?: boolean
  count?: boolean
  head?: boolean
  op?: 'insert' | 'update' | 'upsert' | 'delete' | null
  data?: any
  conflict?: string[]
}

export interface QueryResult {
  data: any
  count?: number
  error: any
  mutated: boolean
}

// ─── Seed ─────────────────────────────────────────────────────
export function buildSeedStore(): LocalStore {
  const users: StoreUser[] = Object.entries(LOCAL_USERS).map(([email, { password, user }]) => ({
    id: user.id,
    email: email.toLowerCase(),
    password,
    role: user.user_metadata.role,
    slot_number: user.user_metadata.slot_number,
  }))

  // structuredClone keeps nested join objects (e.g. event.categories) intact
  return structuredClone({
    categories: MOCK_CATEGORIES,
    events: MOCK_EVENTS,
    schools: MOCK_SCHOOLS,
    participants: MOCK_PARTICIPANTS,
    marks: MOCK_MARKS,
    results: MOCK_RESULTS,
    announcements: MOCK_ANNOUNCEMENTS,
    onspot_registrations: MOCK_ONSPOT,
    guest_credentials: [],
    club_accounts: [],
    guest_marks: [],
    settings: MOCK_SETTINGS,
    users,
  })
}

export function mapAuthUser(u: StoreUser) {
  return {
    id: u.id,
    email: u.email,
    user_metadata: { role: u.role, slot_number: u.slot_number },
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function getTable(store: LocalStore, name: string): any[] {
  switch (name) {
    case 'categories':           return store.categories
    case 'events':               return store.events
    case 'schools':              return store.schools
    case 'participants':         return store.participants
    case 'marks':                return store.marks
    case 'results':              return store.results
    case 'announcements':        return store.announcements
    case 'onspot_registrations': return store.onspot_registrations ?? []
    case 'guest_credentials':    return store.guest_credentials ?? (store.guest_credentials = [])
    case 'guest_marks':          return store.guest_marks ?? (store.guest_marks = [])
    case 'club_accounts':        return store.club_accounts ?? (store.club_accounts = [])
    case 'users':                return store.users
    case 'settings':             return [store.settings]
    default:                     return []
  }
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
}

// Attach the nested join objects the UI expects after a write, so newly
// created rows render the same way as seeded ones.
function enrich(store: LocalStore, table: string, row: any): any {
  if (table === 'events') {
    return { ...row, categories: store.categories.find(c => c.id === row.category_id) }
  }
  if (table === 'results') {
    const ev = store.events.find(e => e.id === row.event_id)
    return { ...row, events: ev ?? null }
  }
  return row
}

function matches(filters: QueryDescriptor['filters'], row: any): boolean {
  return filters.every(f => {
    if (f.op === 'eq')     return row[f.col] === f.val
    if (f.op === 'neq')    return row[f.col] !== f.val
    if (f.op === 'in')     return f.val.includes(row[f.col])
    if (f.op === 'not_is') return row[f.col] !== f.val
    return true
  })
}

// ─── Core ─────────────────────────────────────────────────────
export function runQuery(store: LocalStore, d: QueryDescriptor): QueryResult {
  // ── Mutations ──
  if (d.op) {
    if (d.table === 'settings') {
      if (d.op === 'update' || d.op === 'upsert') {
        Object.assign(store.settings, d.data)
        return { data: null, error: null, mutated: true }
      }
      return { data: null, error: null, mutated: false }
    }

    const rows = getTable(store, d.table)

    if (d.op === 'delete') {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(d.filters, rows[i])) rows.splice(i, 1)
      }
      return { data: null, error: null, mutated: true }
    }

    if (d.op === 'update') {
      rows.forEach((r, i) => {
        if (matches(d.filters, r)) rows[i] = enrich(store, d.table, { ...r, ...d.data })
      })
      return { data: null, error: null, mutated: true }
    }

    // insert / upsert — normalise to an array of records
    const records = Array.isArray(d.data) ? d.data : [d.data]
    const conflict = d.conflict ?? []
    for (const rec of records) {
      let merged = false
      if (d.op === 'upsert' && conflict.length) {
        const idx = rows.findIndex(r => conflict.every(k => r[k] === rec[k]))
        if (idx >= 0) {
          rows[idx] = enrich(store, d.table, { ...rows[idx], ...rec, updated_at: new Date().toISOString() })
          merged = true
        }
      }
      if (!merged) {
        const now = new Date().toISOString()
        rows.push(enrich(store, d.table, {
          id: rec.id ?? genId(d.table.slice(0, 3)),
          created_at: now,
          updated_at: now,
          ...rec,
        }))
      }
    }
    return { data: null, error: null, mutated: true }
  }

  // ── Reads ──
  let rows = getTable(store, d.table).filter(r => matches(d.filters, r))

  d.orders.forEach(o => {
    rows.sort((a, b) => {
      const av = a[o.col], bv = b[o.col]
      if (av == null && bv == null) return 0
      if (av == null) return o.asc ? 1 : -1
      if (bv == null) return o.asc ? -1 : 1
      return o.asc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  })

  if (d.limit) rows = rows.slice(0, d.limit)

  if (d.count) {
    return { data: d.head ? null : rows, count: rows.length, error: null, mutated: false }
  }

  // Attach nested join objects for reads
  rows = rows.map(row => {
    if (d.table === 'participants') {
      return { ...row, events: store.events.find(e => e.id === row.event_id) ?? null }
    }
    if (d.table === 'events') {
      return { ...row, categories: store.categories.find(c => c.id === row.category_id) ?? null }
    }
    if (d.table === 'results') {
      const ev = store.events.find(e => e.id === row.event_id)
      return { ...row, events: ev ? { ...ev, categories: store.categories.find(c => c.id === ev.category_id) ?? null } : null }
    }
    if (d.table === 'onspot_registrations') {
      return { ...row, events: store.events.find(e => e.id === row.event_id) ?? null }
    }
    return row
  })

  if (d.single) {
    return { data: rows[0] ?? null, error: rows.length === 0 ? { message: 'No rows found', code: 'PGRST116' } : null, mutated: false }
  }

  return { data: rows, error: null, mutated: false }
}
