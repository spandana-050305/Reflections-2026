import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Calendar, MapPin, User } from 'lucide-react'
import type { Event, Category } from '@/lib/types'

export default async function ClubSchedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: events }, { data: categories }] = await Promise.all([
    supabase.from('events').select('*, categories(name, display_order)').order('event_date').order('event_time'),
    supabase.from('categories').select('*').order('display_order'),
  ])

  const scheduledEvents = (events as any[] ?? []).filter(e => e.event_date)
  const unscheduled = (events as any[] ?? []).filter(e => !e.event_date)

  // Group by date
  const byDate: Record<string, any[]> = {}
  scheduledEvents.forEach(ev => {
    const d = ev.event_date
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(ev)
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="text-brand-600" size={24} />
        <h2 className="text-2xl font-bold text-gray-900">Event Schedule</h2>
      </div>

      {Object.keys(byDate).length === 0 && unscheduled.length === 0 && (
        <div className="card text-center text-gray-400 py-12">Schedule not published yet.</div>
      )}

      {Object.entries(byDate).map(([date, dayEvents]) => (
        <div key={date} className="card">
          <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
            {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <div className="space-y-2">
            {dayEvents.map((ev: any) => {
              let members: string[] = []
              if (ev.assigned_members) {
                try { members = typeof ev.assigned_members === 'string' ? JSON.parse(ev.assigned_members) : ev.assigned_members } catch {}
              }
              return (
                <div key={ev.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50">
                  {/* Time */}
                  <div className="min-w-[56px] text-base font-bold text-brand-600 shrink-0 pt-0.5">
                    {ev.event_time ? ev.event_time.slice(0, 5) : '—'}
                  </div>
                  {/* Event name + category + members */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-base leading-tight">{ev.name}</p>
                    {ev.categories?.name && (
                      <span className="inline-block mt-1 text-xs font-semibold bg-brand-100 text-brand-700 px-2.5 py-0.5 rounded-full">
                        {ev.categories.name}
                      </span>
                    )}
                    {members.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {members.map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-sm font-semibold bg-brand-200 text-brand-800 px-2.5 py-1 rounded-full">
                            <User size={12} /> {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Venue — right side, highlighted */}
                  {ev.venue && (
                    <div className="shrink-0 pt-0.5">
                      <span className="inline-flex items-center gap-1 text-sm font-bold bg-brand-600 text-white px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm">
                        <MapPin size={13} /> {ev.venue}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {unscheduled.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">Not Yet Scheduled</h3>
          <div className="space-y-2">
            {unscheduled.map((ev: any) => (
              <div key={ev.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-800">{ev.name}</p>
                  {ev.categories?.name && (
                    <span className="inline-block mt-1 text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                      {ev.categories.name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">Date pending</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
