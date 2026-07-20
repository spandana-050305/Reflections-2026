import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Megaphone, School as SchoolIcon, CheckCircle2, Sparkles } from 'lucide-react'
import Blobs from '@/components/layout/Blobs'
import type { Announcement, School } from '@/lib/types'

export default async function AdminDashboard() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  const [
    { data: schools },
    { data: events },
    { data: participants },
    { data: announcements },
    { data: settings },
  ] = await Promise.all([
    supabase.from('schools').select('slot_number, school_name').order('slot_number'),
    supabase.from('events').select('id, name').order('name'),
    supabase.from('participants').select('slot_number, event_id'),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('settings').select('registration_open').maybeSingle(),
  ])

  const totalEvents = events?.length ?? 0
  const totalSchools = schools?.length ?? 0

  const filledMap: Record<number, Set<string>> = {}
  const participantCountMap: Record<number, number> = {}
  ;(participants ?? []).forEach((p: { slot_number: number; event_id: string }) => {
    if (!filledMap[p.slot_number]) filledMap[p.slot_number] = new Set()
    filledMap[p.slot_number].add(p.event_id)
    participantCountMap[p.slot_number] = (participantCountMap[p.slot_number] ?? 0) + 1
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* Hero band */}
      <div className="hero-band">
        <Blobs />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 mb-2">
              <Sparkles size={13} /> Final Year Portal
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold">Welcome back 👋</h2>
            <p className="text-white/85 mt-1.5 text-sm">Manage events, marks and results from one place.</p>
          </div>
        </div>
      </div>

      {/* Registration Status */}
      <div className={`rounded-2xl p-4 flex items-center justify-between border ${settings?.registration_open ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {settings?.registration_open && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${settings?.registration_open ? 'bg-green-500' : 'bg-red-500'}`} />
          </span>
          <span className={`font-semibold text-sm ${settings?.registration_open ? 'text-green-800' : 'text-red-800'}`}>
            Registration is {settings?.registration_open ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
        <a href="/admin/settings" className="text-sm text-gray-500 hover:text-brand-600 font-medium">Change →</a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-brand-100/60 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
              <SchoolIcon className="text-brand-600" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-gradient leading-none">{totalSchools}</p>
              <p className="text-sm text-gray-500 mt-1">Schools</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-green-100/60 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-800 leading-none">{Object.values(filledMap).filter(s => s.size > 0).length}</p>
              <p className="text-sm text-gray-500 mt-1">Schools with entries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Tracker */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Registration Completion Tracker</h3>
        {totalSchools === 0 ? (
          <p className="text-gray-400 text-sm">No schools registered yet. Add schools in the Schools section.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Slot</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">School Name</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Events Filled</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Participants</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {(schools as School[]).map(school => {
                  const filled = filledMap[school.slot_number]?.size ?? 0
                  const pct = totalEvents > 0 ? Math.round((filled / totalEvents) * 100) : 0
                  return (
                    <tr key={school.slot_number} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-700">{school.slot_number}</td>
                      <td className="py-2.5 px-3 text-gray-800">{school.school_name}</td>
                      <td className="py-2.5 px-3 text-gray-600">{filled} / {totalEvents}</td>
                      <td className="py-2.5 px-3 text-gray-600">{participantCountMap[school.slot_number] ?? 0}</td>
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-brand-500 h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-8">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Announcements */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-brand-600" />
            <h3 className="font-semibold text-gray-800">Recent Announcements</h3>
          </div>
          <a href="/admin/announcements" className="text-sm text-brand-600 hover:underline">Manage →</a>
        </div>
        {(announcements as Announcement[] ?? []).length === 0 ? (
          <p className="text-gray-400 text-sm">No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {(announcements as Announcement[]).map(a => (
              <div key={a.id} className="border-l-4 border-brand-200 pl-4 py-1">
                <p className="font-medium text-sm text-gray-800">{a.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
