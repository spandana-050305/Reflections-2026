'use client'

import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, KeyRound, Trash2, Users, School, UserCheck, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react'
import PageSpinner from '@/components/layout/PageSpinner'

interface AuthUser {
  id: string
  email: string
  role: string
  name: string | null
  created_at: string
  last_sign_in_at: string | null
}

const ROLE_ORDER = ['final_year', 'club_member', 'school', 'guest', 'unknown']
const ROLE_LABELS: Record<string, string> = {
  final_year: 'Final Year',
  club_member: 'Club Member',
  school: 'School',
  guest: 'Judge',
  unknown: 'Unknown',
}
const ROLE_COLORS: Record<string, string> = {
  final_year: 'bg-violet-100 text-violet-700',
  club_member: 'bg-blue-50 text-blue-600',
  school: 'bg-green-50 text-green-700',
  guest: 'bg-amber-50 text-amber-700',
  unknown: 'bg-gray-100 text-gray-500',
}
const ROLE_ICONS: Record<string, any> = {
  final_year: ShieldCheck,
  club_member: UserCheck,
  school: School,
  guest: ClipboardList,
  unknown: Users,
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['final_year']))
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flash(msg: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlashMsg(msg)
    flashTimer.current = setTimeout(() => setFlashMsg(''), 3500)
  }

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  async function load() {
    const res = await fetch('/api/superadmin/manage-user')
    const json = await res.json()
    if (!res.ok) { flash(`❌ ${json.error}`); setLoading(false); return }
    setUsers(json.users)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function resetPassword() {
    if (!resetTarget || !newPassword) return
    setBusy(resetTarget.id)
    const res = await fetch('/api/superadmin/manage-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetTarget.id, newPassword }),
    })
    const json = await res.json()
    setBusy(null)
    setResetTarget(null)
    setNewPassword('')
    if (!res.ok) { flash(`❌ ${json.error ?? 'Reset failed'}`); return }
    flash(`Password reset for ${resetTarget.email} ✓`)
  }

  async function deleteUser(user: AuthUser) {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return
    setBusy(user.id)
    const res = await fetch('/api/superadmin/manage-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    const json = await res.json()
    if (!res.ok) { flash(`❌ ${json.error ?? 'Delete failed'}`); setBusy(null); return }
    flash(`${user.email} deleted ✓`)
    setBusy(null)
    await load()
  }

  function toggleGroup(role: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(role) ? next.delete(role) : next.add(role)
      return next
    })
  }

  if (loading) return <PageSpinner />

  const grouped: Record<string, AuthUser[]> = {}
  users.forEach(u => {
    if (!grouped[u.role]) grouped[u.role] = []
    grouped[u.role].push(u)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={22} className="text-violet-600" /> User Management
        </h2>
        <p className="text-sm text-gray-500 mt-1">All registered users across all portals. Super admin only.</p>
      </div>

      {flashMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${flashMsg.startsWith('❌') ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {flashMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLE_ORDER.filter(r => grouped[r]?.length).map(role => {
          const Icon = ROLE_ICONS[role]
          return (
            <div key={role} className="card py-3 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${ROLE_COLORS[role].replace('text-', 'bg-').split(' ')[0]}20`}>
                <Icon size={17} className={ROLE_COLORS[role].split(' ')[1]} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-800">{grouped[role].length}</p>
                <p className="text-xs text-gray-500">{ROLE_LABELS[role]}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* User groups */}
      {ROLE_ORDER.filter(r => grouped[r]?.length).map(role => {
        const roleUsers = grouped[role]
        const isOpen = expanded.has(role)
        const Icon = ROLE_ICONS[role]
        return (
          <div key={role} className="card p-0 overflow-hidden">
            <button
              onClick={() => toggleGroup(role)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <Icon size={17} className={ROLE_COLORS[role].split(' ')[1]} />
                <span className="font-semibold text-gray-800">{ROLE_LABELS[role]}s</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role]}`}>
                  {roleUsers.length}
                </span>
              </div>
              {isOpen ? <ChevronDown size={17} className="text-gray-400" /> : <ChevronRight size={17} className="text-gray-400" />}
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {roleUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Joined {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {u.last_sign_in_at && ` · Last login ${new Date(u.last_sign_in_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setResetTarget(u); setNewPassword('') }}
                        disabled={busy === u.id}
                        title="Reset password"
                        className="text-gray-400 hover:text-brand-500 p-1.5"
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={busy === u.id}
                        title="Delete user"
                        className="text-gray-400 hover:text-red-500 p-1.5"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {users.length === 0 && (
        <div className="card text-center text-gray-400 py-10">No users found.</div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <KeyRound size={18} className="text-brand-600" /> Reset Password
            </h3>
            <p className="text-sm text-gray-500">
              New password for <span className="font-medium text-gray-700 font-mono">{resetTarget.email}</span>
            </p>
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
              <button
                onClick={resetPassword}
                disabled={newPassword.length < 4 || busy === resetTarget.id}
                className="btn-primary text-sm px-4 py-2"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
