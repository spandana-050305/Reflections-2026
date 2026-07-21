import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { LayoutDashboard, ListChecks, Trophy } from 'lucide-react'
import NavBar from '@/components/layout/NavBar'
import NavLink from '@/components/layout/NavLink'

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'school') redirect('/login')

  const slotNumber = user.user_metadata?.slot_number as number | undefined

  const navLinks = [
    { href: '/school/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/school/events', label: 'Events', icon: ListChecks },
    { href: '/school/results', label: 'Results', icon: Trophy },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar title="School Portal" role="school" slotNumber={slotNumber} />
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-60 bg-white/50 backdrop-blur-xl border-r border-white/60 hidden md:block">
          <nav className="p-3 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} label={label}>
                <Icon size={17} />
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Mobile floating bottom nav */}
        <nav className="fixed bottom-3 left-3 right-3 bg-white/85 backdrop-blur-xl border border-white/60 rounded-2xl shadow-card-hover flex md:hidden z-20 p-1.5">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <div key={href} className="flex-1 flex justify-center">
              <NavLink href={href} label={label} variant="mobile">
                <Icon size={19} />
              </NavLink>
            </div>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6 pb-28 md:pb-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
