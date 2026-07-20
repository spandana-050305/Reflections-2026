import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, CheckCircle, Clock } from 'lucide-react'
import type { Category, Event } from '@/lib/types'

// Always re-fetch so "Filled / Pending" reflects the latest saved participants
export const dynamic = 'force-dynamic'

export default async function SchoolEventsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login')

  const slotNumber = user.user_metadata?.slot_number as number | undefined
  if (!slotNumber) redirect('/login')

  const [
    { data: categories },
    { data: events },
    { data: myParticipants },
    { data: settings },
  ] = await Promise.all([
    supabase.from('categories').select('*').order('display_order'),
    supabase.from('events').select('*, categories(name)').order('name'),
    supabase.from('participants').select('event_id').eq('slot_number', slotNumber),
    supabase.from('settings').select('registration_open').maybeSingle(),
  ])

  const isOpen = settings?.registration_open ?? false
  const filledEventIds = new Set((myParticipants ?? []).map((p: { event_id: string }) => p.event_id))

  const eventsByCategory: Record<string, Event[]> = {}
  ;(events as Event[] ?? []).forEach(ev => {
    if (!eventsByCategory[ev.category_id]) eventsByCategory[ev.category_id] = []
    eventsByCategory[ev.category_id].push(ev)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Events</h2>
        <p className="text-gray-500 text-sm mt-1">Select an event to fill in your participants</p>
      </div>

      {!isOpen && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
          Registration is currently closed. You can view your entries but cannot make changes.
        </div>
      )}

      {(categories as Category[] ?? []).map(cat => {
        const catEvents = eventsByCategory[cat.id] ?? []
        if (catEvents.length === 0) return null
        return (
          <div key={cat.id} className="card">
            <h3 className="text-lg font-semibold text-brand-700 mb-4 pb-2 border-b border-gray-100">
              {cat.name}
            </h3>
            <div className="space-y-2">
              {catEvents.map((ev: Event) => {
                const filled = filledEventIds.has(ev.id)
                return (
                  <Link
                    key={ev.id}
                    href={`/school/events/${ev.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 hover:border-brand-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{ev.name}</p>
                        {ev.event_date && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {ev.venue ? ` · ${ev.venue}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {filled ? (
                        <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle size={11} /> Filled
                        </span>
                      ) : (
                        <span className="badge bg-gray-100 text-gray-500 flex items-center gap-1">
                          <Clock size={11} /> Pending
                        </span>
                      )}
                      <span className="text-gray-300 group-hover:text-brand-400 transition-colors">→</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}

      {(events ?? []).length === 0 && (
        <div className="card text-center text-gray-400 py-12">No events published yet.</div>
      )}
    </div>
  )
}
