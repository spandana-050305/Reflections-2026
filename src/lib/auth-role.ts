// Reads a user's role/slot from Supabase Auth metadata.
//
// SECURITY: `user_metadata` is editable by the end user themselves (via
// `supabase.auth.updateUser()` from the browser), so it must never be
// trusted alone for authorization decisions — a user could self-grant
// `role: 'super_admin'`. `app_metadata` can only be set by the service
// role (our server-side API routes), so it is the trustworthy source.
//
// We read app_metadata first and fall back to user_metadata only for
// accounts that haven't been backfilled yet (see supabase/schema.sql).
// Once every account has app_metadata.role set, the fallback is inert.
type MetaUser = {
  user_metadata?: Record<string, unknown> | null
  app_metadata?: Record<string, unknown> | null
} | null | undefined

export function getRole(user: MetaUser): string | undefined {
  const appRole = user?.app_metadata?.role
  if (typeof appRole === 'string' && appRole) return appRole
  const legacyRole = user?.user_metadata?.role
  return typeof legacyRole === 'string' ? legacyRole : undefined
}

export function getSlotNumber(user: MetaUser): number | undefined {
  const appSlot = user?.app_metadata?.slot_number
  if (typeof appSlot === 'number') return appSlot
  const legacySlot = user?.user_metadata?.slot_number
  return typeof legacySlot === 'number' ? legacySlot : undefined
}
