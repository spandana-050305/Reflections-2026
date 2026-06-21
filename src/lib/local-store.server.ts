// ─── File-backed store (server only) ──────────────────────────
// The single source of truth for local dev mode. Both server
// components and the browser (via /api/local/*) read & write here,
// so every role sees the same live data — just like Supabase will.

import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  buildSeedStore, runQuery, mapAuthUser,
  type LocalStore, type QueryDescriptor, type StoreUser,
} from './local-engine'
import { LOCAL_USERS } from './local-auth'

// Store the DB outside the OneDrive-synced project folder.
// OneDrive locks files during sync, causing partial writes and JSON corruption.
// %APPDATA% (C:\Users\...\AppData\Roaming) is never synced by OneDrive.
const DATA_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'reflections-local')
  : path.join(os.tmpdir(), 'reflections-local')
const DB_FILE = path.join(DATA_DIR, 'reflections-db.json')

// Log on module load so you can see which file is being used in the terminal
console.log('[Reflections] DB file:', DB_FILE)

function ensureFile() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DB_FILE, JSON.stringify(buildSeedStore(), null, 2))
  }
}

function readStore(): LocalStore {
  ensureFile()
  let raw = ''
  try {
    raw = fs.readFileSync(DB_FILE, 'utf8')
    const store = JSON.parse(raw) as LocalStore

    // Validate it's a real store object (not empty `{}` from a reset)
    if (!store || !Array.isArray(store.participants)) {
      throw new Error('Invalid store shape — re-seeding')
    }

    // ── Migrate: add any tables/fields that didn't exist when the DB file was created ──
    let dirty = false
    if (!Array.isArray(store.onspot_registrations)) {
      store.onspot_registrations = []
      dirty = true
    }
    if (!Array.isArray(store.guest_credentials)) {
      store.guest_credentials = []
      dirty = true
    }
    if (!Array.isArray(store.guest_marks)) {
      store.guest_marks = []
      dirty = true
    }
    if (!Array.isArray(store.club_accounts)) {
      store.club_accounts = []
      dirty = true
    }
    if (store.settings && store.settings.points_1st == null) {
      store.settings.points_1st = 15
      store.settings.points_2nd = 10
      store.settings.points_3rd = 5
      dirty = true
    }
    // Default criteria_count for events created before this field existed.
    store.events.forEach((ev: any) => {
      if (ev.criteria_count == null) { ev.criteria_count = 4; dirty = true }
    })
    // Drop stale accounts from the old fixed judge1-4 system (superseded by
    // admin-generated guest credentials) so they no longer appear or log in.
    const beforeCount = store.users.length
    store.users = store.users.filter((u: any) => u.role !== 'judge')
    if (store.users.length !== beforeCount) dirty = true
    // Add any seed accounts that don't exist yet — never removes or
    // overwrites existing users.
    Object.entries(LOCAL_USERS).forEach(([email, { password, user }]) => {
      const lower = email.toLowerCase()
      if (!store.users.find(u => u.email === lower)) {
        store.users.push({
          id: user.id,
          email: lower,
          password,
          role: user.user_metadata.role,
          slot_number: user.user_metadata.slot_number,
        })
        dirty = true
      }
    })

    if (dirty) writeStore(store)
    return store
  } catch {
    // Corrupted / truncated / empty file — start fresh from seed data.
    // Schools, marks, and other user data will be lost, but the app won't crash.
    const seed = buildSeedStore()
    writeStore(seed)
    return seed
  }
}

function writeStore(store: LocalStore) {
  // Atomic write: write to a temp file first, then rename.
  // This prevents truncated / corrupted JSON when two requests
  // write concurrently (common during Next.js hot-reloads).
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const tmp = DB_FILE + '.tmp'
    const content = JSON.stringify(store, null, 2)
    fs.writeFileSync(tmp, content)
    try {
      fs.renameSync(tmp, DB_FILE)
    } catch (renameErr) {
      // Windows can sometimes fail to rename over an existing file; fall back to direct write
      try { fs.copyFileSync(tmp, DB_FILE) } catch {}
      try { fs.unlinkSync(tmp) } catch {}
    }
  } catch (e) {
    console.error('[Reflections] writeStore error:', e)
  }
}

export function executeQuery(descriptor: QueryDescriptor) {
  const store = readStore()
  const result = runQuery(store, descriptor)
  if (result.mutated) writeStore(store)
  return { data: result.data, count: result.count, error: result.error }
}

export function signInUser(email: string, password: string) {
  const store = readStore()
  const user = store.users.find(u => u.email === email && u.password === password)
  if (!user) return { user: null, error: { message: 'Invalid email or password' } }
  return { user: mapAuthUser(user), error: null }
}

export function signUpUser(email: string, password: string, data: Record<string, any>) {
  const store = readStore()
  if (store.users.find(u => u.email === email)) {
    return { user: null, error: { message: 'Email already registered' } }
  }
  const newUser: StoreUser = {
    id: crypto.randomUUID(),
    email,
    password,
    role: data.role ?? 'school',
    slot_number: data.slot_number,
  }
  store.users.push(newUser)
  writeStore(store)
  return { user: mapAuthUser(newUser), error: null }
}

export function getUser(id: string) {
  const store = readStore()
  const user = store.users.find(u => u.id === id)
  if (!user) return { user: null, error: { message: 'User not found' } }
  return { user: mapAuthUser(user), error: null }
}