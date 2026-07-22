'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ShieldCheck, KeyRound, Trash2, Users, School, UserCheck,
  ClipboardList, ChevronDown, ChevronRight, Ban, CheckCircle2,
  LogOut, ArrowUpDown,
} from 'lucide-react'
import PageSpinner from '@/components/layout/PageSpinner'

interface AuthUser {
  id: string
  email: string
  role: string
  banned: boolean
  created_at: string
  last_sign_in_at: string | null
}

const ROLE_ORDER = ['super_admin', 'final_year', 'club_member', 'school', 'guest', 'unknown']
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  final_year: 'Final Year',
  club_member: 'Club Member',
  school: 'School',
  guest: 'Judge',
  unknown: 'Unknown',
}
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-violet-100 text-violet-700',
  final_year: 'bg-violet-50 text-violet-600',
  club_member: 'bg-blue-50 text-blue-600',
  school: 'bg-green-50 text-green-700',
  guest: 'bg-amber-50 text-amber-700',
  unknown: 'bg-gray-100 text-gray-500',
}
const ROLE_ICONS: Record<string, any> = {
  super_admin: ShieldCheck,
  final_year: ShieldCheck,
  club_member: UserCheck,
  school: School,
  guest: ClipboardList,
  unknown: Users,
}
const PROMOTABLE_ROLES = ['club_member', 'final_year', 'school', 'guest']

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['final_year']))
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null)
  const [roleTarget, setRoleTarget] = useState<AuthUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('')
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

  async function callAction(action: string, user: AuthUser, extra?: Record<string, any>) {
    setBusy(user.id)
    const res = await fetch('/api/superadmin/manage-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: user.id, targetEmail: user.email, ...extra }),
    })
    const json = await res.json()
    setBusy(null)
    if (!res.ok) { flash(`❌ ${json.error ?? 'Action failed'}`); return false }
    return true
  }

  async function resetPassword() {
    if (!resetTarget || !newPassword) return
    const ok = await callAction('reset_password', resetTarget, { newPassword })
    if (ok) {
      flash(`Password reset for ${resetTarget.email} ✓`)
      setResetTarget(null)
      setNewPassword('')
    }
  }

  async function changeRole() {
    if (!roleTarget || !newRole) return
    const ok = await callAction('change_role', roleTarget, { newRole })
    if (ok) {
      flash(`Role changed to ${ROLE_LABELS[newRole]} for ${roleTarget.email} ✓`)
      setRoleTarget(null)
      setNewRole('')
      await load()
    }
  }

  async function suspend(user: AuthUser) {
    if (!confirm(`Suspend ${user.email}? They will be immediately logged out and cannot log in.`)) return
    const ok = await callAction('suspend', user)
    if (ok) { flash(`${user.email} suspended ✓`); await load() }
  }

  async function unsuspend(user: AuthUser) {
    const ok = await callAction('unsuspend', user)
    if (ok) { flash(`${user.email} unsuspended ✓`); await load() }
  }

  async function forceLogout(user: AuthUser) {
    if (!confirm(`Force logout ${user.email}? Their current session will be invalidated immediately.`)) return
    setBusy(user.id)
    flash(`Logging out ${user.email}…`)
    const ok = await callAction('force_logout', user)
    if (ok) flash(`${user.email} logged out ✓`)
  }

  async function deleteUser(user: AuthUser) {
    if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return
    setBusy(user.id)
    const res = await fetch('/api/superadmin/manage-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, targetEmail: user.email }),
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
        <p className="text-sm text-gray-500 mt-1">All registered users. Promote, suspend, reset passwords, force logout.</p>
      </div>

      {flashMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${flashMsg.startsWith('❌') ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {flashMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLE_ORDER.filter(r => grouped[r]?.length && r !== 'super_admin').map(role => {
          const Icon = ROLE_ICONS[role]
          return (
            <div key={role} className="card py-3 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${ROLE_COLORS[role]}`}>
                <Icon size={16} />
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
                  <div key={u.id} className={`flex items-center justify-between px-5 py-3 gap-3 ${u.banned ? 'bg-red-50/40' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 truncate font-mono">{u.email}</p>
                        {u.banned && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Suspended</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Joined {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {u.last_sign_in_at
                          ? ` · Last login ${new Date(u.last_sign_in_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                          : ' · Never logged in'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Promote/demote — not for super_admin */}
                      {role !== 'super_admin' && (
                        <button
                          onClick={() => { setRoleTarget(u); setNewRole(u.role) }}
                          disabled={busy === u.id}
                          title="Change role"
                          className="text-gray-400 hover:text-violet-500 p-1.5"
                        >
                          <ArrowUpDown size={14} />
                        </button>
                      )}
                      {/* Reset password */}
                      <button
                        onClick={() => { setResetTarget(u); setNewPassword('') }}
                        disabled={busy === u.id}
                        title="Reset password"
                        className="text-gray-400 hover:text-brand-500 p-1.5"
                      >
                        <KeyRound size={14} />
                      </button>
                      {/* Force logout */}
                      {role !== 'super_admin' && (
                        <button
                          onClick={() => forceLogout(u)}
                          disabled={busy === u.id}
                          title="Force logout"
                          className="text-gray-400 hover:text-amber-500 p-1.5"
                        >
                          <LogOut size={14} />
                        </button>
                      )}
                      {/* Suspend / unsuspend */}
                      {role !== 'super_admin' && (
                        u.banned
                          ? <button onClick={() => unsuspend(u)} disabled={busy === u.id} title="Unsuspend" className="text-gray-400 hover:text-green-500 p-1.5"><CheckCircle2 size={14} /></button>
                          : <button onClick={() => suspend(u)} disabled={busy === u.id} title="Suspend" className="text-gray-400 hover:text-orange-500 p-1.5"><Ban size={14} /></button>
                      )}
                      {/* Delete */}
                      {role !== 'super_admin' && (
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={busy === u.id}
                          title="Delete user"
                          className="text-gray-400 hover:text-red-500 p-1.5"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
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
            <p className="text-sm text-gray-500">New password for <span className="font-mono font-medium text-gray-700">{resetTarget.email}</span></p>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 4 chars)" className="input w-full" autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResetTarget(null)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
              <button onClick={resetPassword} disabled={newPassword.length < 4 || busy === resetTarget.id}
                className="btn-primary text-sm px-4 py-2">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {roleTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ArrowUpDown size={18} className="text-violet-600" /> Change Role
            </h3>
            <p className="text-sm text-gray-500">Change role for <span className="font-mono font-medium text-gray-700">{roleTarget.email}</span></p>
            <div className="grid grid-cols-2 gap-2">
              {PROMOTABLE_ROLES.map(r => (
                <button key={r} type="button" onClick={() => setNewRole(r)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${newRole === r ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRoleTarget(null)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
              <button onClick={changeRole} disabled={!newRole || newRole === roleTarget.role || busy === roleTarget.id}
                className="btn-primary text-sm px-4 py-2">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
