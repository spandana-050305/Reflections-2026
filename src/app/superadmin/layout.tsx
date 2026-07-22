import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { ShieldCheck, Users, LayoutDashboard, Activity } from 'lucide-react'
import NavBar from '@/components/layout/NavBar'
import NavLink from '@/components/layout/NavLink'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'super_admin') redirect('/login')

  const navLinks = [
    { href: '/superadmin/dashboard', label: 'Health Dashboard', icon: LayoutDashboard },
    { href: '/superadmin/users', label: 'User Management', icon: Users },
    { href: '/superadmin/activity', label: 'Activity Log', icon: Activity },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar title="Super Admin" role="final_year" />
      <div className="flex flex-1">
        <aside className="w-60 bg-white/50 backdrop-blur-xl border-r border-white/60 hidden md:flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Super Admin</p>
          </div>
          <nav className="p-3 space-y-1 flex-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} label={label}>
                <Icon size={17} />
              </NavLink>
            ))}
            <div className="pt-3 mt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 pb-2">Admin Portal</p>
              <NavLink href="/admin/dashboard" label="Go to Admin Portal">
                <ShieldCheck size={17} />
              </NavLink>
            </div>
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

        <main className="flex-1 p-4 sm:p-6 pb-28 md:pb-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
