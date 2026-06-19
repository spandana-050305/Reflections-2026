import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Trophy } from 'lucide-react'
import NavBar from '@/components/layout/NavBar'
import NavLink from '@/components/layout/NavLink'

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

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
        <aside className="w-60 bg-white/60 backdrop-blur border-r border-slate-200 hidden md:block">
          <nav className="p-3 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} label={label}>
                <Icon size={17} />
              </NavLink>
            ))}
          </nav>
        </aside>

        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-slate-200 flex md:hidden z-20">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <div key={href} className="flex-1 flex justify-center">
              <NavLink href={href} label={label} variant="mobile">
                <Icon size={19} />
              </NavLink>
            </div>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-8 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
