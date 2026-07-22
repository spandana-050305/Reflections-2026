'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { UserCheck, Check, X, Clock, CheckCircle2, XCircle, RotateCcw, Trash2, KeyRound } from 'lucide-react'
import type { ClubAccount, ClubAccountStatus } from '@/lib/types'
import PageSpinner from '@/components/layout/PageSpinner'

const FILTERS: { key: ClubAccountStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

export default function AdminRequestsPage() {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<ClubAccount[]>([])
  const [filter, setFilter] = useState<ClubAccountStatus | 'all'>('pending')
  const [flashMsg, setFlashMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<ClubAccount | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  function flash(msg: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlashMsg(msg)
    flashTimer.current = setTimeout(() => setFlashMsg(''), 3500)
  }

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  async function load() {
    const { data, error } = await supabase.from('club_accounts').select('*').order('created_at', { ascending: false })
    if (error) { flash(`❌ Failed to load requests: ${error.message}`); setLoading(false); return }
    setAccounts((data as ClubAccount[]) ?? [])
    setLastRefreshed(new Date())
    setLoading(false)
  }

  useEffect(() => {
    load()
    refreshTimer.current = setInterval(load, 30000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [])

  async function setStatus(acct: ClubAccount, status: ClubAccountStatus) {
    setBusy(acct.id)

    if (status === 'approved') {
      // Use API route to confirm email in Supabase Auth + update status
      const res = await fetch('/api/admin/approve-club-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: acct.id, userId: acct.user_id }),
      })
      const json = await res.json()
      if (!res.ok) { flash(`❌ ${json.error ?? 'Approval failed'}`); setBusy(null); return }
    } else {
      const { error } = await supabase.from('club_accounts')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', acct.id)
      if (error) { flash(`❌ ${error.message}`); setBusy(null); return }
    }

    await load()
    flash(`${acct.name} ${status === 'approved' ? 'approved ✓ — they can now log in' : status === 'rejected' ? 'rejected' : 'updated'} ✓`)
    setBusy(null)
  }

  async function resetPassword() {
    if (!resetTarget || !newPassword) return
    setBusy(resetTarget.id)
    const res = await fetch('/api/admin/reset-club-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetTarget.user_id, email: resetTarget.email, newPassword }),
    })
    const json = await res.json()
    setBusy(null)
    setResetTarget(null)
    setNewPassword('')
    if (!res.ok) { flash(`❌ ${json.error ?? 'Reset failed'}`); return }
    flash(`Password reset for ${resetTarget.name} ✓`)
  }

  async function deleteRequest(acct: ClubAccount) {
    if (!confirm(`Delete ${acct.name}'s request? This also removes their login (${acct.email}). They'd have to register again.`)) return
    setBusy(acct.id)
    const res = await fetch('/api/admin/delete-club-account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: acct.id, email: acct.email }),
    })
    if (!res.ok) { flash(`❌ Delete failed (${res.status})`); setBusy(null); return }
    await load()
    flash(`${acct.name}'s request deleted ✓`)
    setBusy(null)
  }

  if (loading) return <PageSpinner />

  const pendingCount = accounts.filter(a => a.status === 'pending').length
  const visible = filter === 'all' ? accounts : accounts.filter(a => a.status === filter)

  const statusBadge = (s: ClubAccountStatus) => {
    if (s === 'approved') return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle2 size={11} /> Approved</span>
    if (s === 'rejected') return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><XCircle size={11} /> Rejected</span>
    return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Clock size={11} /> Pending</span>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck size={22} className="text-brand-600" /> Club Member Requests
          </h2>
          {lastRefreshed && (
            <span className="text-xs text-gray-400">Auto-refreshes every 30s · Last: {lastRefreshed.toLocaleTimeString()}</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">Approve or reject club members who registered from the sign-in page.</p>
      </div>

      {flashMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${flashMsg.startsWith('❌') ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-green-50 border border-green-200 text-green-700'}`}>{flashMsg}</div>
      )}

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === f.key ? 'bg-brand-600 text-white shadow-glow' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}>
            {f.label}{f.key === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card text-center text-gray-400 py-10">No {filter === 'all' ? '' : filter} requests.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(a => (
            <div key={a.id} className="card flex items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-800">{a.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.role === 'final_year' ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-600'}`}>
                    {a.role === 'final_year' ? 'Final Year — full access' : 'Club Member'}
                  </span>
                  {statusBadge(a.status)}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{a.email}</p>
                <p className="text-xs text-gray-400">Requested {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.status === 'pending' && (
                  <>
                    <button onClick={() => setStatus(a, 'approved')} disabled={busy === a.id}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><Check size={13} /> Approve</button>
                    <button onClick={() => setStatus(a, 'rejected')} disabled={busy === a.id}
                      className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1"><X size={13} /> Reject</button>
                  </>
                )}
                {a.status === 'approved' && (
                  <button onClick={() => setStatus(a, 'rejected')} disabled={busy === a.id}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"><X size={13} /> Revoke</button>
                )}
                {a.status === 'rejected' && (
                  <button onClick={() => setStatus(a, 'approved')} disabled={busy === a.id}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"><RotateCcw size={13} /> Approve</button>
                )}
                <button onClick={() => { setResetTarget(a); setNewPassword('') }} disabled={busy === a.id}
                  title="Reset password" className="text-gray-400 hover:text-brand-500 p-1.5"><KeyRound size={15} /></button>
                <button onClick={() => deleteRequest(a)} disabled={busy === a.id}
                  title="Delete request" className="text-gray-400 hover:text-red-500 p-1.5"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><KeyRound size={18} className="text-brand-600" /> Reset Password</h3>
            <p className="text-sm text-gray-500">Set a new password for <span className="font-medium text-gray-700">{resetTarget.name}</span> ({resetTarget.email})</p>
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 4 chars)"
              className="input w-full"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResetTarget(null)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
              <button onClick={resetPassword} disabled={newPassword.length < 4 || busy === resetTarget.id}
                className="btn-primary text-sm px-4 py-2">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
