import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Megaphone, ListChecks, CheckCircle2, CalendarDays, Sparkles, Users } from 'lucide-react'
import Blobs from '@/components/layout/Blobs'
import type { Announcement } from '@/lib/types'

export default async function SchoolDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const slotNumber = user.user_metadata?.slot_number as number | undefined
  if (!slotNumber) redirect('/login')

  const [
    { data: announcements },
    { data: events },
    { data: myParticipants },
    { data: settings },
    { data: schoolRow },
  ] = await Promise.all([
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('events').select('id'),
    supabase.from('participants').select('event_id').eq('slot_number', slotNumber),
    supabase.from('settings').select('registration_open').maybeSingle(),
    supabase.from('schools').select('school_name').eq('slot_number', slotNumber).maybeSingle(),
  ])

  const schoolName = schoolRow?.school_name ?? `Slot ${slotNumber}`

  const totalEvents = events?.length ?? 0
  const filledEvents = new Set((myParticipants ?? []).map((p: { event_id: string }) => p.event_id)).size
  const totalParticipants = (myParticipants ?? []).length

  const pct = totalEvents > 0 ? Math.min(100, Math.round((filledEvents / totalEvents) * 100)) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Hero band */}
      <div className="hero-band">
        <Blobs />
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 mb-2">
            <Sparkles size={13} /> School Portal
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold">Welcome, {schoolName}</h2>
          <p className="text-white/85 mt-1.5 text-sm">Reflections Event Management</p>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`rounded-2xl p-4 flex items-center gap-3 border ${settings?.registration_open ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <span className="relative flex h-3 w-3">
          {settings?.registration_open && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${settings?.registration_open ? 'bg-green-500' : 'bg-red-500'}`} />
        </span>
        <span className={`font-semibold text-sm ${settings?.registration_open ? 'text-green-800' : 'text-red-800'}`}>
          {settings?.registration_open
            ? 'Registration is OPEN — fill your participants now'
            : 'Registration is CLOSED — entries are frozen'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-brand-100/60 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="text-brand-600" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-gradient leading-none">{filledEvents}</p>
              <p className="text-sm text-gray-500 mt-1">Events filled</p>
            </div>
          </div>
          {totalEvents > 0 && (
            <div className="relative mt-4">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span><span>{pct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-violet-100/60 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <Users className="text-violet-600" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-800 leading-none">{totalParticipants}</p>
              <p className="text-sm text-gray-500 mt-1">Participants entered</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-slate-100 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <CalendarDays className="text-slate-500" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-700 leading-none">{totalEvents}</p>
              <p className="text-sm text-gray-500 mt-1">Total events</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action */}
      <Link
        href="/school/events"
        className="card card-interactive flex items-center gap-4 group"
      >
        <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-glow">
          <ListChecks className="text-white" size={22} />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Fill Participants</p>
          <p className="text-sm text-gray-500">Add names for each event your school is entering</p>
        </div>
        <span className="ml-auto text-brand-400 text-lg group-hover:translate-x-1 transition-transform">→</span>
      </Link>

      {/* Announcements */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={18} className="text-brand-600" />
          <h3 className="font-semibold text-gray-800">Announcements</h3>
        </div>
        {(announcements as Announcement[] ?? []).length === 0 ? (
          <p className="text-gray-400 text-sm">No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {(announcements as Announcement[]).map(a => (
              <div key={a.id} className="border-l-4 border-brand-200 pl-4 py-1">
                <p className="font-medium text-sm text-gray-800">{a.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{a.message}</p>
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
