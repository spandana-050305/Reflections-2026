import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'

export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'guest') redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar title="Guest Evaluator" role="guest" />
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
