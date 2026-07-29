import type { SupabaseClient } from '@supabase/supabase-js'

// Writes role/slot fields to BOTH user_metadata and app_metadata.
//
// SECURITY: app_metadata is the source of truth RLS policies and server
// checks trust (see src/lib/auth-role.ts); user_metadata is kept in sync
// only for backward compatibility during rollout. Supabase's admin
// updateUserById REPLACES user_metadata/app_metadata wholesale rather
// than merging, so we fetch the user first and merge in JS to avoid
// wiping out unrelated fields (e.g. clobbering a school's slot_number
// when only their role changes, or vice versa).
export async function setUserRoleMetadata(
  admin: SupabaseClient,
  userId: string,
  fields: Record<string, unknown>
) {
  const { data, error: fetchErr } = await admin.auth.admin.getUserById(userId)
  if (fetchErr) return { error: fetchErr }

  const existingUserMeta = data?.user?.user_metadata ?? {}
  const existingAppMeta = data?.user?.app_metadata ?? {}

  return admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...existingUserMeta, ...fields },
    app_metadata: { ...existingAppMeta, ...fields },
  })
}
