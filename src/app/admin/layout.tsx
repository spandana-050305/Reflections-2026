import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import {
  LayoutDashboard, ListChecks, Users,
  TableProperties, Trophy, School, Megaphone, Settings, ClipboardCheck, UserCheck, Clock, XCircle
} from 'lucide-react'
import NavBar from '@/components/layout/NavBar'
import NavLink from '@/components/layout/NavLink'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Self-registered Final Years need approval before getting full access.
  // Seeded / admin-created accounts have no club_accounts row → allowed through.
  const { data: acct } = await supabase
    .from('club_accounts')
    .select('status')
    .eq('email', user.email)
    .limit(1)
  const account = (acct ?? [])[0]
  if (account && account.status !== 'approved') {
    const rejected = account.status === 'rejected'
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar title="Final Year Portal" role="final_year" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card max-w-md w-full text-center space-y-4 py-10">
            <div className={`mx-auto h-14 w-14 rounded-full flex items-center justify-center ${rejected ? 'bg-red-100' : 'bg-amber-100'}`}>
              {rejected ? <XCircle size={26} className="text-red-600" /> : <Clock size={26} className="text-amber-600" />}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{rejected ? 'Request declined' : 'Awaiting approval'}</h2>
            <p className="text-sm text-gray-500">
              {rejected
                ? 'Your Final Year access request was not approved. Please contact the existing admin.'
                : 'Your Final Year access request is waiting to be approved by an existing admin.'}
            </p>
          </div>
        </main>
      </div>
    )
  }

  const navLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/events', label: 'Events', icon: ListChecks },
    { href: '/admin/participants', label: 'Participants', icon: Users },
    { href: '/admin/guest-marks', label: 'Guest Marks', icon: ClipboardCheck },
    { href: '/admin/points', label: 'Points Table', icon: TableProperties },
    { href: '/admin/results', label: 'Results', icon: Trophy },
    { href: '/admin/schools', label: 'Schools', icon: School },
    { href: '/admin/requests', label: 'Requests', icon: UserCheck },
    { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar title="Final Year Portal" role="final_year" />
      <div className="flex flex-1">
        <aside className="w-60 bg-white/50 backdrop-blur-xl border-r border-white/60 hidden md:flex flex-col">
          <nav className="p-3 space-y-1 flex-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} label={label}>
                <Icon size={17} />
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Mobile: floating scrollable bottom nav */}
        <nav className="fixed bottom-3 left-3 right-3 bg-white/85 backdrop-blur-xl border border-white/60 rounded-2xl shadow-card-hover flex md:hidden z-20 overflow-x-auto p-1.5 gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <NavLink key={href} href={href} label={label} variant="mobile">
              <Icon size={18} />
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6 pb-28 md:pb-8 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
