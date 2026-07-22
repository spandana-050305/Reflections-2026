'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, X, Save, Shuffle, Copy, Check, Eye, EyeOff, KeyRound, FileDown } from 'lucide-react'
import PageSpinner from '@/components/layout/PageSpinner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function generateEmail(schoolName: string): string {
  const slug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '')
    .substring(0, 15)
  return `${slug || 'school'}@reflections.in`
}

export default function AdminSchoolsPage() {
  const supabase = createClient()
  const [schools, setSchools] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ school_name: '', slot_number: '' })
  const [previewEmail, setPreviewEmail] = useState('')
  const [previewPass, setPreviewPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [createdCreds, setCreatedCreds] = useState<{ school_name: string; slot: number | null; email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [showShuffleWarning, setShowShuffleWarning] = useState(false)
  const [showAllCreds, setShowAllCreds] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resetTarget, setResetTarget] = useState<any | null>(null)
  const [resetPass, setResetPass] = useState('')
  const [resetting, setResetting] = useState(false)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  const schoolsOrdered = [...schools].sort((a, b) => (a.slot_number ?? 9999) - (b.slot_number ?? 9999))

  async function load() {
    const { data, error } = await supabase.from('schools').select('*').order('slot_number')
    if (error) { showMsg(`❌ Failed to load schools: ${error.message}`, 'error') }
    setSchools(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Only update the email when school name changes; keep the same password throughout
  useEffect(() => {
    setPreviewEmail(generateEmail(form.school_name))
  }, [form.school_name])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    if (msgTimer.current) clearTimeout(msgTimer.current)
    setMessage(text)
    setMessageType(type)
    msgTimer.current = setTimeout(() => setMessage(''), 4000)
  }

  function openCreateForm() {
    setForm({ school_name: '', slot_number: '' })
    setPreviewPass(generatePassword())
    setShowForm(true)
  }

  async function handleCreate() {
    if (!form.school_name.trim()) { showMsg('School name is required.', 'error'); return }
    if (form.slot_number) {
      const slotNum = +form.slot_number
      if (schools.find(s => s.slot_number === slotNum)) {
        showMsg(`Slot ${slotNum} is already assigned to another school.`, 'error')
        return
      }
    }

    setSaving(true)
    const email = previewEmail
    const password = previewPass
    const slotNum = form.slot_number ? +form.slot_number : null

    const res = await fetch('/api/admin/manage-school', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, schoolName: form.school_name.trim(), slotNumber: slotNum }),
    })
    const json = await res.json()
    if (!res.ok) {
      showMsg('Error creating school: ' + (json.error ?? 'Unknown error'), 'error')
      setSaving(false)
      return
    }

    setCreatedCreds({ school_name: form.school_name.trim(), slot: slotNum, email, password })
    setForm({ school_name: '', slot_number: '' })
    setShowForm(false)
    await load()
    setSaving(false)
  }

  async function handleDelete(school: any) {
    if (!confirm(`Delete "${school.school_name}"? This will remove all their participant data.`)) return
    const res = await fetch('/api/admin/manage-school', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: school.id, userId: school.user_id, slotNumber: school.slot_number }),
    })
    if (!res.ok) { showMsg(`❌ Delete failed (${res.status})`, 'error'); return }
    setSchools(prev => prev.filter(s => s.id !== school.id))
  }

  async function handleResetPassword() {
    if (!resetTarget || !resetPass) return
    setResetting(true)
    const res = await fetch('/api/admin/reset-club-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetTarget.user_id, email: resetTarget.email, newPassword: resetPass }),
    })
    const json = await res.json()
    setResetting(false)
    if (!res.ok) { showMsg(`❌ ${json.error ?? 'Reset failed'}`, 'error'); return }
    // Update password_plain in schools table
    await supabase.from('schools').update({ password_plain: resetPass }).eq('id', resetTarget.id)
    setSchools(prev => prev.map(s => s.id === resetTarget.id ? { ...s, password_plain: resetPass } : s))
    showMsg(`Password reset for ${resetTarget.school_name} ✓`)
    setResetTarget(null)
    setResetPass('')
  }

  async function handleShuffle() {
    setShowShuffleWarning(false)
    setShuffling(true)

    const res = await fetch('/api/admin/shuffle-slots', { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      showMsg(`❌ ${json.error ?? 'Shuffle failed'}`, 'error')
      setShuffling(false)
      return
    }

    await load()
    showMsg('Slot numbers shuffled!')
    setShuffling(false)
  }

  function copyCredsToClipboard(creds: { school_name: string; slot: number | null; email: string; password: string }) {
    const text = `School: ${creds.school_name}\nSlot: ${creds.slot ?? 'Not assigned'}\nEmail: ${creds.email}\nPassword: ${creds.password}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function copyAllCreds() {
    const lines = schoolsOrdered
      .filter(s => s.email)
      .map(s => `${s.school_name} | Slot: ${s.slot_number ?? '-'} | ${s.email} | ${s.password_plain ?? '(unknown)'}`)
      .join('\n')
    navigator.clipboard.writeText(lines)
    showMsg('All credentials copied to clipboard!')
  }

  function downloadAllCreds() {
    const rows = schoolsOrdered.filter(s => s.email)
    const csv = 'Slot,School Name,Email,Password\n' + rows.map(s => {
      const name = `"${(s.school_name ?? '').replace(/"/g, '""')}"`
      return `${s.slot_number ?? ''},${name},${s.email ?? ''},${s.password_plain ?? ''}`
    }).join('\n') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reflections-credentials.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadAllPDF() {
    const doc = new jsPDF()
    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('School Credentials', 14, 18)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`Reflections - ${date} - Keep this confidential`, 14, 26)
    doc.setTextColor(0)

    const rows = schoolsOrdered.filter(s => s.email).map(s => [
      s.slot_number ?? '-',
      s.school_name ?? '',
      s.email ?? '',
      s.password_plain ?? '',
    ])

    autoTable(doc, {
      startY: 32,
      head: [['Slot', 'School Name', 'Email', 'Password']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [219, 39, 119], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 242, 248] },
      columnStyles: { 0: { cellWidth: 14 }, 2: { cellWidth: 55 }, 3: { cellWidth: 30 } },
    })

    doc.save('reflections-credentials.pdf')
  }

  function downloadAllExcel() {
    const rows = schoolsOrdered.filter(s => s.email).map(s => ({
      Slot: s.slot_number ?? '',
      'School Name': s.school_name ?? '',
      Email: s.email ?? '',
      Password: s.password_plain ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 30 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials')
    XLSX.writeFile(wb, 'reflections-credentials.xlsx')
  }

  function downloadSchoolCreds(school: any) {
    const slot = school.slot_number ?? ''
    const name = `"${(school.school_name ?? '').replace(/"/g, '""')}"`
    const email = school.email ?? ''
    const pass = school.password_plain ?? ''
    const csv = `Slot,School Name,Email,Password\n${slot},${name},${email},${pass}\n`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `slot-${slot}-credentials.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadSchoolExcel(school: any) {
    const ws = XLSX.utils.json_to_sheet([{
      Slot: school.slot_number ?? '',
      'School Name': school.school_name ?? '',
      Email: school.email ?? '',
      Password: school.password_plain ?? '',
    }])
    ws['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 30 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials')
    XLSX.writeFile(wb, `slot-${school.slot_number ?? 'na'}-credentials.xlsx`)
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Schools</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openCreateForm} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add School
          </button>
          <button onClick={() => setShowShuffleWarning(true)} disabled={shuffling} className="btn-secondary flex items-center gap-2 text-sm">
            <Shuffle size={14} /> {shuffling ? 'Shuffling...' : 'Shuffle Slots'}
          </button>
          <button onClick={() => setShowAllCreds(s => !s)} className="btn-secondary flex items-center gap-2 text-sm">
            {showAllCreds ? <EyeOff size={14} /> : <Eye size={14} />} {showAllCreds ? 'Hide Passwords' : 'Show Passwords'}
          </button>
          <button onClick={copyAllCreds} className="btn-secondary flex items-center gap-2 text-sm">
            <Copy size={14} /> Copy All
          </button>
          <button onClick={downloadAllCreds} className="btn-secondary flex items-center gap-2 text-sm">
            <FileDown size={14} /> Export CSV
          </button>
          <button onClick={downloadAllExcel} className="btn-secondary flex items-center gap-2 text-sm">
            <FileDown size={14} /> Export Excel
          </button>
          <button onClick={downloadAllPDF} className="btn-secondary flex items-center gap-2 text-sm">
            <FileDown size={14} /> Export PDF
          </button>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${messageType === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {showShuffleWarning && (
        <div className="card border-amber-200 bg-amber-50/60 space-y-3">
          <p className="text-sm text-amber-800 font-medium">
            Shuffling will randomly reassign slot numbers to all schools and update their participants and marks. Any computed results will be cleared (re-compute after shuffling). This cannot be undone. Continue?
          </p>
          <div className="flex gap-2">
            <button onClick={handleShuffle} className="btn-danger text-sm">Yes, shuffle</button>
            <button onClick={() => setShowShuffleWarning(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">New School</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">School Name</label>
              <input
                className="input"
                value={form.school_name}
                onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))}
                placeholder="e.g. St. Joseph's School"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Slot Number (optional)</label>
              <input
                type="number"
                className="input"
                value={form.slot_number}
                onChange={e => setForm(f => ({ ...f, slot_number: e.target.value }))}
                placeholder="e.g. 1"
              />
            </div>
          </div>
          {form.school_name.trim() && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              <p className="text-gray-500">Generated credentials:</p>
              <p className="font-mono text-gray-700">{previewEmail}</p>
              <p className="font-mono text-gray-700">{previewPass}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
              <Save size={14} /> {saving ? 'Creating...' : 'Create School'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {createdCreds && (
        <div className="card border-brand-200 bg-brand-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-brand-700 flex items-center gap-2">
              <KeyRound size={16} /> School Created
            </h3>
            <button onClick={() => setCreatedCreds(null)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500">School:</span> <span className="font-medium">{createdCreds.school_name}</span></p>
            <p><span className="text-gray-500">Slot:</span> <span className="font-medium">{createdCreds.slot ?? 'Not assigned'}</span></p>
            <p><span className="text-gray-500">Email:</span> <span className="font-mono">{createdCreds.email}</span></p>
            <p><span className="text-gray-500">Password:</span> <span className="font-mono">{createdCreds.password}</span></p>
          </div>
          <button onClick={() => copyCredsToClipboard(createdCreds)} className="btn-secondary flex items-center gap-2 text-sm">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy Credentials'}
          </button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Slot</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">School</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Password</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {schoolsOrdered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No schools yet.</td></tr>
            )}
            {schoolsOrdered.map((s: any) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 font-medium">{s.slot_number ?? '-'}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{s.school_name}</td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.email ?? '-'}</td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                  {showAllCreds ? (s.password_plain ?? '-') : '********'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => downloadSchoolCreds(s)} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                      <FileDown size={12} /> CSV
                    </button>
                    <button onClick={() => downloadSchoolExcel(s)} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                      <FileDown size={12} /> Excel
                    </button>
                    <button onClick={() => { setResetTarget(s); setResetPass(generatePassword()) }} className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                      <KeyRound size={12} /> Reset Password
                    </button>
                    <button onClick={() => handleDelete(s)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Reset Password Modal */}
    {resetTarget && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <KeyRound size={18} className="text-amber-500" /> Reset Password
          </h3>
          <p className="text-sm text-gray-500">
            New password for <span className="font-mono font-medium text-gray-700">{resetTarget.school_name}</span>
            <br /><span className="text-xs text-gray-400">{resetTarget.email}</span>
          </p>
          <input
            type="text"
            value={resetPass}
            onChange={e => setResetPass(e.target.value)}
            className="input w-full font-mono"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setResetTarget(null)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button
              onClick={handleResetPassword}
              disabled={resetPass.length < 4 || resetting}
              className="btn-primary text-sm px-4 py-2"
            >
              {resetting ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </div>
      </div>
    )}
  )
}
