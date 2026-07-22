'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Activity, RefreshCw } from 'lucide-react'
import PageSpinner from '@/components/layout/PageSpinner'

const ACTION_LABELS: Record<string, string> = {
  approve_club_account: 'Approved club member',
  delete_club_account: 'Deleted club member',
  create_school: 'Created school',
  delete_school: 'Deleted school',
  reset_password: 'Reset password',
  change_role: 'Changed role',
  suspend_user: 'Suspended user',
  unsuspend_user: 'Unsuspended user',
  force_logout: 'Force logged out',
  delete_user: 'Deleted user',
}

const ACTION_COLORS: Record<string, string> = {
  approve_club_account: 'bg-green-100 text-green-700',
  delete_club_account: 'bg-red-100 text-red-700',
  create_school: 'bg-blue-100 text-blue-700',
  delete_school: 'bg-red-100 text-red-700',
  reset_password: 'bg-amber-100 text-amber-700',
  change_role: 'bg-violet-100 text-violet-700',
  suspend_user: 'bg-orange-100 text-orange-700',
  unsuspend_user: 'bg-green-100 text-green-700',
  force_logout: 'bg-orange-100 text-orange-700',
  delete_user: 'bg-red-100 text-red-700',
}

export default function ActivityLogPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data ?? [])
    setLastRefreshed(new Date())
    setLoading(false)
  }

  useEffect(() => {
    load()
    refreshTimer.current = setInterval(load, 30000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={22} className="text-violet-600" /> Activity Log
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Actions taken by all admins · last 200 entries
            {lastRefreshed && <span className="ml-2 text-xs text-gray-400">· Last: {lastRefreshed.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">No activity recorded yet.</div>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-gray-50">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-4 px-5 py-3.5">
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 mt-0.5 ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                {ACTION_LABELS[log.action] ?? log.action}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-700">{log.actor_email ?? '—'}</span>
                  <span className="text-xs text-gray-400">({log.actor_role ?? '—'})</span>
                  {log.target_email && (
                    <>
                      <span className="text-xs text-gray-300">→</span>
                      <span className="text-sm text-gray-600 font-mono">{log.target_email}</span>
                    </>
                  )}
                </div>
                {log.details && <p className="text-xs text-gray-400 mt-0.5">{log.details}</p>}
              </div>
              <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
