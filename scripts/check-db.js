const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://kbhxzslqtxdekqmfaqqo.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiaHh6c2xxdHhkZWtxbWZhcXFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM2NDU1OCwiZXhwIjoyMDk5OTQwNTU4fQ.onA3AnjKl_1ED4wZv7HOx2E7cLNsfvGqL2yaC_Ttz8w'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const tables = ['categories', 'events', 'schools', 'participants', 'marks', 'guest_marks', 'results']
  for (const t of tables) {
    const { data, error } = await admin.from(t).select('*', { count: 'exact', head: true })
    if (error) console.log(`  ${t}: ✗ ERROR — ${error.message}`)
    else console.log(`  ${t}: ✓ exists`)
  }
}

main()
