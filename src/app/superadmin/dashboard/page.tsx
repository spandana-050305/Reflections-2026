import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { School, ListChecks, ClipboardCheck, Trophy, UserCheck, Users, ShieldCheck } from 'lucide-react'

export default async function SuperAdminDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'super_admin') redirect('/login')

  const [
    { data: schools },
    { data: events },
    { data: guestMarks },
    { data: results },
    { data: pendingRequests },
    { data: clubAccounts },
    { data: settings },
  ] = await Promise.all([
    supabase.from('schools').select('id', { count: 'exact' }),
    supabase.from('events').select('id', { count: 'exact' }),
    supabase.from('guest_marks').select('event_id', { count: 'exact' }),
    supabase.from('results').select('event_id, published'),
    supabase.from('club_accounts').select('id').eq('status', 'pending'),
    supabase.from('club_accounts').select('id, status, role'),
    supabase.from('settings').select('registration_open').maybeSingle(),
  ])

  const totalSchools = schools?.length ?? 0
  const totalEvents = events?.length ?? 0
  const totalMarkRows = guestMarks?.length ?? 0
  const eventsWithResults = (results ?? []).length
  const publishedResults = (results ?? []).filter((r: any) => r.published).length
  const pendingCount = pendingRequests?.length ?? 0
  const approvedClub = (clubAccounts ?? []).filter((a: any) => a.status === 'approved').length
  const totalClub = (clubAccounts ?? []).length

  const stats = [
    { label: 'Schools', value: totalSchools, icon: School, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Events', value: totalEvents, icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Mark rows submitted', value: totalMarkRows, icon: ClipboardCheck, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Results computed', value: eventsWithResults, icon: Trophy, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'Results published', value: publishedResults, icon: Trophy, color: 'text-brand-600', bg: 'bg-brand-100' },
    { label: 'Pending requests', value: pendingCount, icon: UserCheck, color: pendingCount > 0 ? 'text-red-600' : 'text-gray-400', bg: pendingCount > 0 ? 'bg-red-100' : 'bg-gray-100' },
    { label: 'Club members approved', value: `${approvedClub}/${totalClub}`, icon: Users, color: 'text-violet-600', bg: 'bg-violet-100' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={22} className="text-violet-600" /> System Health
        </h2>
        <p className="text-sm text-gray-500 mt-1">Live overview of the entire platform.</p>
      </div>

      {/* Registration status */}
      <div className={`rounded-2xl p-4 flex items-center gap-3 border ${settings?.registration_open ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <span className="relative flex h-3 w-3">
          {settings?.registration_open && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${settings?.registration_open ? 'bg-green-500' : 'bg-red-500'}`} />
        </span>
        <span className={`font-semibold text-sm ${settings?.registration_open ? 'text-green-800' : 'text-red-800'}`}>
          School registration is {settings?.registration_open ? 'OPEN' : 'CLOSED'}
        </span>
        <a href="/admin/settings" className="ml-auto text-sm text-gray-500 hover:text-brand-600 font-medium">Change →</a>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="card space-y-2">
        <h3 className="font-semibold text-gray-800 mb-3">Quick Actions</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { href: '/superadmin/users', label: 'Manage Users', desc: 'Promote, suspend, reset passwords' },
            { href: '/superadmin/activity', label: 'Activity Log', desc: 'See what final year members did' },
            { href: '/admin/requests', label: 'Club Requests', desc: `${pendingCount} pending approval` },
            { href: '/admin/guest-marks', label: 'Guest Marks', desc: 'View and lock judge submissions' },
            { href: '/admin/results', label: 'Results', desc: `${publishedResults} of ${eventsWithResults} published` },
            { href: '/admin/schools', label: 'Schools', desc: `${totalSchools} registered` },
          ].map(({ href, label, desc }) => (
            <a key={href} href={href} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all">
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <span className="text-gray-300 text-lg">→</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
