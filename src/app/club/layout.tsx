import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Trophy, Clock, XCircle } from 'lucide-react'
import NavBar from '@/components/layout/NavBar'
import NavLink from '@/components/layout/NavLink'

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/')
  if (user.user_metadata?.role !== 'club_member') redirect('/')

  // Self-registered club members must be approved by the Super Admin.
  // Seeded / admin-created accounts have no club_accounts row → allowed through.
  const { data: acct } = await supabase
    .from('club_accounts')
    .select('status, name')
    .eq('email', user.email)
    .limit(1)
  const account = (acct ?? [])[0]
  if (account && account.status !== 'approved') {
    const rejected = account.status === 'rejected'
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar title="Club Member Portal" role="club_member" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card max-w-md w-full text-center space-y-4 py-10">
            <div className={`mx-auto h-14 w-14 rounded-full flex items-center justify-center ${rejected ? 'bg-red-100' : 'bg-amber-100'}`}>
              {rejected ? <XCircle size={26} className="text-red-600" /> : <Clock size={26} className="text-amber-600" />}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {rejected ? 'Request declined' : 'Awaiting approval'}
            </h2>
            <p className="text-sm text-gray-500">
              {rejected
                ? 'Your club member registration was not approved. Please contact the Final Year admin if you think this is a mistake.'
                : 'Your club member account is waiting for the Final Year admin to approve it. Please check back later.'}
            </p>
          </div>
        </main>
      </div>
    )
  }

  const navLinks = [
    { href: '/club/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/club/participants', label: 'Participants', icon: Users },
    { href: '/club/schedule', label: 'Schedule', icon: Calendar },
    { href: '/club/results', label: 'Results', icon: Trophy },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar title="Club Member Portal" role="club_member" />
      <div className="flex flex-1">
        <aside className="w-60 bg-white/50 backdrop-blur-xl border-r border-white/60 hidden md:block">
          <nav className="p-3 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} label={label}>
                <Icon size={17} />
              </NavLink>
            ))}
          </nav>
        </aside>

        <nav className="fixed bottom-3 left-3 right-3 bg-white/85 backdrop-blur-xl border border-white/60 rounded-2xl shadow-card-hover flex md:hidden z-20 p-1.5">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <div key={href} className="flex-1 flex justify-center">
              <NavLink href={href} label={label} variant="mobile">
                <Icon size={19} />
              </NavLink>
            </div>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6 pb-28 md:pb-8 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
