const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://kbhxzslqtxdekqmfaqqo.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiaHh6c2xxdHhkZWtxbWZhcXFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM2NDU1OCwiZXhwIjoyMDk5OTQwNTU4fQ.onA3AnjKl_1ED4wZv7HOx2E7cLNsfvGqL2yaC_Ttz8w'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // List all users to find the admin
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) { console.error('Error listing users:', listErr.message); process.exit(1) }

  console.log('All users in Supabase Auth:')
  users.forEach(u => {
    console.log(`  ${u.email}  role=${u.user_metadata?.role ?? 'none'}  confirmed=${u.email_confirmed_at ? 'yes' : 'NO'}`)
  })

  const adminUser = users.find(u => u.email === 'admin@reflections.in')
  if (!adminUser) { console.error('\n✗ admin@reflections.in not found!'); process.exit(1) }

  // Reset password + confirm email
  const { error } = await admin.auth.admin.updateUserById(adminUser.id, {
    password: 'Admin@123',
    email_confirm: true,
    user_metadata: { role: 'final_year' },
  })

  if (error) { console.error('\n✗ Reset failed:', error.message); process.exit(1) }
  console.log('\n✓ Password reset to Admin@123 and email confirmed.')
  console.log('  Email:    admin@reflections.in')
  console.log('  Password: Admin@123')
}

main()
