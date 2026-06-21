import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import {
  LayoutDashboard, ListChecks, Users,
  TableProperties, Trophy, School, Megaphone, Settings, ClipboardCheck
} from 'lucide-react'
import NavBar from '@/components/layout/NavBar'
import NavLink from '@/components/layout/NavLink'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const navLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/events', label: 'Events', icon: ListChecks },
    { href: '/admin/participants', label: 'Participants', icon: Users },
    { href: '/admin/guest-marks', label: 'Guest Marks', icon: ClipboardCheck },
    { href: '/admin/points', label: 'Points Table', icon: TableProperties },
    { href: '/admin/results', label: 'Results', icon: Trophy },
    { href: '/admin/schools', label: 'Schools', icon: School },
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
