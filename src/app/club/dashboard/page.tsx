import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import type { Announcement } from '@/lib/types'

export default async function ClubDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: announcements },
    { data: settings },
    { count: totalParticipants },
    { count: totalEvents },
  ] = await Promise.all([
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('settings').select('registration_open').maybeSingle(),
    supabase.from('participants').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Club Dashboard</h2>
        <p className="text-gray-500 mt-1">Overview of Reflections</p>
      </div>

      <div className={`rounded-xl p-4 flex items-center gap-3 ${settings?.registration_open ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className={`w-3 h-3 rounded-full ${settings?.registration_open ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={`font-medium text-sm ${settings?.registration_open ? 'text-green-800' : 'text-red-800'}`}>
          Registration is {settings?.registration_open ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-brand-600">{totalParticipants ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Total participants registered</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-600">{totalEvents ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Events</p>
        </div>
      </div>

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
