'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Megaphone, Trash2, Plus, X, Send } from 'lucide-react'
import type { Announcement } from '@/lib/types'

export default function AdminAnnouncementsPage() {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', message: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function handlePost() {
    if (!form.title || !form.message) return
    setSaving(true)
    await supabase.from('announcements').insert({ title: form.title, message: form.message })
    setForm({ title: '', message: '' })
    setShowForm(false)
    setSaving(false)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    await load()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="text-brand-600" size={24} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Announcements</h2>
            <p className="text-gray-500 text-sm">Visible to all schools and club members</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card border border-brand-100 bg-brand-50/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">New Announcement</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Schedule Update" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
              <textarea
                className="input resize-none"
                rows={4}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Type your announcement here…"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handlePost} disabled={saving || !form.title || !form.message} className="btn-primary flex items-center gap-2">
              <Send size={15} /> {saving ? 'Posting…' : 'Post Announcement'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {announcements.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">
          No announcements yet. Post one to notify all schools and club members.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="card flex items-start justify-between gap-4 group">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone size={14} className="text-brand-500" />
                  <p className="font-semibold text-gray-800 text-sm">{a.title}</p>
                </div>
                <p className="text-sm text-gray-600">{a.message}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
