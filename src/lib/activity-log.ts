import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function logActivity({
  action,
  actorEmail,
  actorRole,
  targetEmail,
  targetId,
  details,
}: {
  action: string
  actorEmail?: string | null
  actorRole?: string | null
  targetEmail?: string | null
  targetId?: string | null
  details?: string | null
}) {
  try {
    await adminClient().from('activity_logs').insert({
      action,
      actor_email: actorEmail ?? null,
      actor_role: actorRole ?? null,
      target_email: targetEmail ?? null,
      target_id: targetId ?? null,
      details: details ?? null,
    })
  } catch {
    // Logging failure should never break the main action
  }
}
