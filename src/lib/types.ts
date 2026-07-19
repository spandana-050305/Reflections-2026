export type UserRole = 'school' | 'club_member' | 'final_year' | 'guest'

// Guest evaluators self-select a judge seat (1..6) after logging in —
// the seat is not tied to their account, so multiple guest accounts can
// be used across the day while only 6 judge panel seats exist per event.
export const MAX_JUDGES = 6

// How many practice (unsaved) submissions a guest judge gets before the
// real, locked evaluation.
export const NUM_TRIALS = 2

// assigned_members is sometimes stored as a JSON string (older events saved
// before a fix) instead of a real array — normalize it everywhere it's read.
export function parseAssignedMembers(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export interface School {
  id: string
  user_id: string
  school_name: string
  slot_number: number
  created_at: string
}

export interface Category {
  id: string
  name: string
  display_order: number
}

export interface Event {
  id: string
  category_id: string
  name: string
  rulebook_url: string | null
  max_entries: number
  is_team_event: boolean
  team_size: number | null
  event_date: string | null
  event_time: string | null
  venue: string | null
  assigned_members: string[] | null
  criteria_count: number
  criteria_names: string[] | null
  rules: string | null
  created_at: string
  categories?: Category
}

export interface Participant {
  id: string
  slot_number: number
  event_id: string
  participant_name: string
  entry_index: number
  member_index: number
  created_at: string
  events?: Event
}

export interface Mark {
  id: string
  slot_number: number
  event_id: string
  scores: number[]
  total: number
  created_at: string
  updated_at: string
}

export interface Result {
  id: string
  event_id: string
  first_slot: number | null
  second_slot: number | null
  third_slot: number | null
  winners_json?: string | null
  published: boolean
  created_at: string
  updated_at: string
  events?: Event
}

export interface Announcement {
  id: string
  title: string
  message: string
  created_at: string
}

export interface Settings {
  id: number
  registration_open: boolean
  points_1st?: number
  points_2nd?: number
  points_3rd?: number
  // Password required to Unlock / Full Unlock marks in Guest Marks.
  unlock_password?: string | null
  // Security-question answers used to reset the unlock password.
  security_answer_1?: string | null
  security_answer_2?: string | null
}

// A club member's self-registration, reviewed by the Super Admin (Final Year).
// The auth user is created at registration; `status` gates portal access.
export type ClubAccountStatus = 'pending' | 'approved' | 'rejected'
// Self-registration is limited to these two access levels.
export type RegisterRole = 'final_year' | 'club_member'
export interface ClubAccount {
  id: string
  name: string
  login_id: string
  email: string
  role: RegisterRole
  status: ClubAccountStatus
  created_at: string
  reviewed_at?: string | null
}

// Fixed security questions asked when setting/resetting the unlock password.
export const SECURITY_QUESTIONS = [
  'What is your favourite food?',
  'If you could have any superpower, what would it be?',
]

// Admin-managed login credentials for guest marks evaluators.
export interface GuestCredential {
  id: string
  login_id: string
  email: string
  password_plain: string
  created_at: string
}

// One guest judge's submitted criteria scores for one participant entry,
// in one event. Locked once written — only ever upserted by the guest's
// own (event_id, judge_number, slot_number, entry_index) combination, and
// existence of any row for (event_id, judge_number) means that judge seat
// has already submitted and is locked for everyone else.
export interface GuestMark {
  id: string
  event_id: string
  judge_number: number
  judge_name: string
  slot_number: number
  entry_index: number
  criteria_scores: number[]
  judge_total: number
  locked?: boolean
  created_at: string
  updated_at: string
}
