import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Megaphone, Calendar, ListChecks, CheckCircle } from 'lucide-react'
import type { Announcement, Event, Participant } from '@/lib/types'

export default async function SchoolDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const slotNumber = user.user_metadata?.slot_number as number

  const [
    { data: announcements },
    { data: events },
    { data: myParticipants },
    { data: settings },
  ] = await Promise.all([
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('events').select('id').not('event_date', 'is', null),
    supabase.from('participants').select('event_id').eq('slot_number', slotNumber),
    supabase.from('settings').select('registration_open').single(),
  ])

  const totalEvents = events?.length ?? 0
  const filledEvents = new Set((myParticipants ?? []).map((p: { event_id: string }) => p.event_id)).size

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome, Slot {slotNumber}</h2>
        <p className="text-gray-500 mt-1">Reflections Event Management</p>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${settings?.registration_open ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className={`w-3 h-3 rounded-full ${settings?.registration_open ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={`font-medium text-sm ${settings?.registration_open ? 'text-green-800' : 'text-red-800'}`}>
          {settings?.registration_open
            ? 'Registration is OPEN — fill your participants now'
            : 'Registration is CLOSED — entries are frozen'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-brand-600">{filledEvents}</p>
          <p className="text-sm text-gray-500 mt-1">Events filled</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-400">{totalEvents}</p>
          <p className="text-sm text-gray-500 mt-1">Total events scheduled</p>
        </div>
      </div>

      {/* Quick Action */}
      <Link
        href="/school/events"
        className="card flex items-center gap-4 hover:border-brand-200 hover:shadow-md transition-all group"
      >
        <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center group-hover:bg-brand-200 transition-colors">
          <ListChecks className="text-brand-600" size={22} />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Fill Participants</p>
          <p className="text-sm text-gray-500">Add names for each event your school is entering</p>
        </div>
        <span className="ml-auto text-brand-400 text-lg">→</span>
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
