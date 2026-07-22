import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import NavBar from '@/components/layout/NavBar'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'super_admin') redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar title="Super Admin" role="final_year" />
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
