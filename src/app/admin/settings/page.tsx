'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Settings, Lock, Unlock, Plus, Trash2, Copy, Eye, EyeOff, FileDown, KeyRound, X, Save, Layers } from 'lucide-react'
import * as XLSX from 'xlsx'

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function slugifyLoginId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._-]/g, '').trim()
}

function loginIdToEmail(loginId: string): string {
  return `${slugifyLoginId(loginId)}@reflections.in`
}

export default function AdminSettingsPage() {
  const supabase = createClient()
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // ── Guest evaluator credentials ──
  const [guestCreds, setGuestCreds] = useState<any[]>([])
  const [showAllPasswords, setShowAllPasswords] = useState(false)
  const [gMessage, setGMessage] = useState('')
  const [gMessageType, setGMessageType] = useState<'success' | 'error'>('success')
  const [gSaving, setGSaving] = useState(false)
  const [showSingleForm, setShowSingleForm] = useState(false)
  const [singleLoginId, setSingleLoginId] = useState('')
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkPrefix, setBulkPrefix] = useState('judge')
  const [bulkCount, setBulkCount] = useState(10)

  useEffect(() => {
    supabase.from('settings').select('registration_open').single().then(({ data }: { data: { registration_open: boolean } | null }) => {
      if (data) setRegistrationOpen(data.registration_open)
      setLoading(false)
    })
    loadGuestCreds()
  }, [])

  async function loadGuestCreds() {
    const { data } = await supabase.from('guest_credentials').select('*').order('login_id')
    setGuestCreds(data ?? [])
  }

  async function handleToggle(newValue: boolean) {
    const action = newValue ? 'open' : 'close'
    if (!confirm(`Are you sure you want to ${action} registration? ${!newValue ? 'Schools will no longer be able to edit participants.' : 'Schools will be able to edit their participants again.'}`)) return
    setSaving(true)
    await supabase.from('settings').update({ registration_open: newValue }).eq('id', 1)
    setRegistrationOpen(newValue)
    setMessage(`Registration is now ${newValue ? 'OPEN' : 'CLOSED'}.`)
    setSaving(false)
    setTimeout(() => setMessage(''), 4000)
  }

  function showGMsg(text: string, type: 'success' | 'error' = 'success') {
    setGMessage(text)
    setGMessageType(type)
    setTimeout(() => setGMessage(''), 5000)
  }

  async function createGuestCredential(loginId: string): Promise<{ ok: boolean; error?: string }> {
    const slug = slugifyLoginId(loginId)
    if (!slug) return { ok: false, error: 'Login ID is empty after removing invalid characters.' }
    if (guestCreds.find(c => c.login_id === slug)) return { ok: false, error: `Login ID "${slug}" already exists.` }

    const email = loginIdToEmail(slug)
    const password = generatePassword()

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: 'guest' } },
    })
    if (authErr) return { ok: false, error: authErr.message }

    const { error: dbErr } = await supabase.from('guest_credentials').insert({
      login_id: slug,
      email,
      password_plain: password,
    })
    if (dbErr) return { ok: false, error: dbErr.message }

    return { ok: true }
  }

  async function handleAddSingle() {
    if (!singleLoginId.trim()) { showGMsg('Login ID is required.', 'error'); return }
    setGSaving(true)
    const result = await createGuestCredential(singleLoginId)
    if (!result.ok) {
      showGMsg(result.error ?? 'Failed to create credential.', 'error')
    } else {
      showGMsg(`Credential created for "${slugifyLoginId(singleLoginId)}".`)
      setSingleLoginId('')
      setShowSingleForm(false)
      await loadGuestCreds()
    }
    setGSaving(false)
  }

  async function handleBulkGenerate() {
    const count = Math.max(1, Math.min(50, bulkCount || 0))
    const prefix = slugifyLoginId(bulkPrefix) || 'judge'
    setGSaving(true)

    let created = 0
    let skipped = 0
    const existing = new Set(guestCreds.map(c => c.login_id))
    let n = 1
    while (created < count && n <= count + existing.size + 50) {
      const loginId = `${prefix}${n}`
      n++
      if (existing.has(loginId)) { skipped++; continue }
      const result = await createGuestCredential(loginId)
      if (result.ok) { created++; existing.add(loginId) }
      else skipped++
    }

    showGMsg(`Created ${created} credential${created === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped — already existed)` : ''}.`)
    setShowBulkForm(false)
    await loadGuestCreds()
    setGSaving(false)
  }

  async function handleDeleteGuestCred(cred: any) {
    if (!confirm(`Delete credential "${cred.login_id}"? The guest will no longer be able to log in.`)) return
    await supabase.from('guest_credentials').delete().eq('id', cred.id)
    await loadGuestCreds()
  }

  function copyAllGuestCreds() {
    const lines = guestCreds.map(c => `${c.login_id} | ${c.email} | ${c.password_plain ?? '(unknown)'}`).join('\n')
    navigator.clipboard.writeText(lines)
    showGMsg('All credentials copied to clipboard!')
  }

  function downloadGuestCredsCSV() {
    const csv = 'Login ID,Email,Password\n' + guestCreds.map(c => {
      const id = `"${(c.login_id ?? '').replace(/"/g, '""')}"`
      return `${id},${c.email ?? ''},${c.password_plain ?? ''}`
    }).join('\n') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'guest-evaluator-credentials.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadGuestCredsExcel() {
    const rows = guestCreds.map(c => ({ 'Login ID': c.login_id ?? '', Email: c.email ?? '', Password: c.password_plain ?? '' }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Guest Credentials')
    XLSX.writeFile(wb, 'guest-evaluator-credentials.xlsx')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="text-brand-600" size={24} />
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
      </div>

      {/* Registration Toggle */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-1">Participant Registration</h3>
        <p className="text-sm text-gray-500 mb-5">
          When closed, schools cannot add, edit, or delete their participant entries. Marks and results are unaffected.
        </p>

        <div className={`rounded-xl p-5 flex items-center justify-between ${registrationOpen ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-3">
            {registrationOpen
              ? <Unlock size={20} className="text-green-600" />
              : <Lock size={20} className="text-red-600" />}
            <div>
              <p className={`font-semibold ${registrationOpen ? 'text-green-800' : 'text-red-800'}`}>
                Registration is {registrationOpen ? 'OPEN' : 'CLOSED'}
              </p>
              <p className={`text-sm ${registrationOpen ? 'text-green-600' : 'text-red-600'}`}>
                {registrationOpen
                  ? 'Schools can currently fill and edit their participants'
                  : 'All participant entries are frozen'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleToggle(!registrationOpen)}
            disabled={saving}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              registrationOpen
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {saving ? 'Saving…' : registrationOpen ? 'Close Registration' : 'Open Registration'}
          </button>
        </div>

        {message && (
          <p className="text-sm font-medium text-gray-700 mt-3 bg-gray-50 px-4 py-2 rounded-lg">
            ✓ {message}
          </p>
        )}
      </div>

      {/* Guest Evaluator Credentials */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <KeyRound size={16} className="text-brand-600" /> Guest Evaluator Credentials
            </h3>
            <p className="text-sm text-gray-500">
              Create login IDs for guest judges. Each guest signs in on the regular login page, then picks a category, judge number, and event to evaluate.
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setShowSingleForm(s => !s); setShowBulkForm(false) }} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add One Credential
          </button>
          <button onClick={() => { setShowBulkForm(s => !s); setShowSingleForm(false) }} className="btn-secondary flex items-center gap-2 text-sm">
            <Layers size={14} /> Bulk Generate
          </button>
          {guestCreds.length > 0 && (
            <>
              <button onClick={() => setShowAllPasswords(s => !s)} className="btn-secondary flex items-center gap-2 text-sm">
                {showAllPasswords ? <EyeOff size={14} /> : <Eye size={14} />} {showAllPasswords ? 'Hide Passwords' : 'Show Passwords'}
              </button>
              <button onClick={copyAllGuestCreds} className="btn-secondary flex items-center gap-2 text-sm">
                <Copy size={14} /> Copy All
              </button>
              <button onClick={downloadGuestCredsCSV} className="btn-secondary flex items-center gap-2 text-sm">
                <FileDown size={14} /> CSV
              </button>
              <button onClick={downloadGuestCredsExcel} className="btn-secondary flex items-center gap-2 text-sm">
                <FileDown size={14} /> Excel
              </button>
            </>
          )}
        </div>

        {gMessage && (
          <div className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${gMessageType === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
            {gMessage}
          </div>
        )}

        {showSingleForm && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">New guest login ID</p>
              <button onClick={() => setShowSingleForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <input
              className="input"
              value={singleLoginId}
              onChange={e => setSingleLoginId(e.target.value)}
              placeholder="e.g. dr_priya or guest_panel2"
            />
            {singleLoginId.trim() && (
              <p className="text-xs text-gray-500">Will sign in as <span className="font-mono">{loginIdToEmail(singleLoginId)}</span> with an auto-generated password.</p>
            )}
            <button onClick={handleAddSingle} disabled={gSaving} className="btn-primary flex items-center gap-2 text-sm">
              <Save size={14} /> {gSaving ? 'Creating…' : 'Create Credential'}
            </button>
          </div>
        )}

        {showBulkForm && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Bulk generate credentials</p>
              <button onClick={() => setShowBulkForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Login ID prefix</label>
                <input className="input" value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value)} placeholder="judge" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">How many?</label>
                <input type="number" min={1} max={50} className="input" value={bulkCount} onChange={e => setBulkCount(+e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Generates login IDs like <span className="font-mono">{slugifyLoginId(bulkPrefix) || 'judge'}1</span>, <span className="font-mono">{slugifyLoginId(bulkPrefix) || 'judge'}2</span>, … skipping any that already exist.
            </p>
            <button onClick={handleBulkGenerate} disabled={gSaving} className="btn-primary flex items-center gap-2 text-sm">
              <Save size={14} /> {gSaving ? 'Generating…' : `Generate ${bulkCount || 0} Credentials`}
            </button>
          </div>
        )}

        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Login ID</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Password</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {guestCreds.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No guest credentials yet.</td></tr>
              )}
              {guestCreds.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{c.login_id}</td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{c.email}</td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{showAllPasswords ? c.password_plain : '********'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => handleDeleteGuestCred(c)} className="text-xs text-red-500 hover:underline flex items-center gap-1 justify-end">
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info card */}
      <div className="card bg-amber-50 border border-amber-200">
        <h3 className="font-semibold text-amber-800 text-sm mb-2">Important Notes</h3>
        <ul className="text-sm text-amber-700 space-y-1.5 list-disc list-inside">
          <li>Closing registration freezes entries for all 60 schools simultaneously.</li>
          <li>You can re-open registration at any time if corrections are needed.</li>
          <li>Marks and results are not affected by this toggle.</li>
          <li>Schools will see a clear message when registration is closed.</li>
          <li>Guest evaluators pick their judge number (1–6) themselves after logging in — assign numbers to physical judges on the day, out loud.</li>
        </ul>
      </div>
    </div>
  )
}
