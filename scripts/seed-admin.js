/**
 * One-time script to create the initial Final Year (admin) account.
 * Run once: node scripts/seed-admin.js
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://kbhxzslqtxdekqmfaqqo.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiaHh6c2xxdHhkZWtxbWZhcXFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM2NDU1OCwiZXhwIjoyMDk5OTQwNTU4fQ.onA3AnjKl_1ED4wZv7HOx2E7cLNsfvGqL2yaC_Ttz8w'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMIN_EMAIL    = 'admin@reflections.in'
const ADMIN_PASSWORD = 'Admin@123'

async function main() {
  console.log('Creating admin (Final Year) account…')

  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,          // skip email confirmation
    user_metadata: { role: 'final_year' },
  })

  if (error) {
    if (error.message?.includes('already')) {
      console.log('✓ Admin user already exists — try logging in with:')
    } else {
      console.error('✗ Error:', error.message)
      process.exit(1)
    }
  } else {
    console.log('✓ Admin user created! Log in with:')
  }

  console.log(`  Email:    ${ADMIN_EMAIL}`)
  console.log(`  Password: ${ADMIN_PASSWORD}`)
  console.log('\nChange the password after first login via Supabase dashboard → Authentication → Users.')
}

main()
