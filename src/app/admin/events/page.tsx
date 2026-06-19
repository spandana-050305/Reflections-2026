'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Pencil, Trash2, FileText, X, Save } from 'lucide-react'
import type { Category, Event } from '@/lib/types'
import { parseAssignedMembers } from '@/lib/types'

const EMPTY_FORM = {
  name: '',
  category_id: '',
  max_entries: 1,
  is_team_event: false,
  team_size: 1,
  event_date: '',
  event_time: '',
  venue: '',
  member1: '',
  member2: '',
  member3: '',
  criteria_count: 4,
}

export default function AdminEventsPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const [{ data: cats }, { data: evs }] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*, categories(name)').order('name'),
    ])
    setCategories(cats ?? [])
    setEvents(evs ?? [])
  }

  useEffect(() => { load() }, [])

  function startEdit(ev: any) {
    setEditId(ev.id)
    const members: string[] = parseAssignedMembers(ev.assigned_members)
    setForm({
      name: ev.name,
      category_id: ev.category_id,
      max_entries: ev.max_entries,
      is_team_event: ev.is_team_event,
      team_size: ev.team_size ?? 1,
      event_date: ev.event_date ?? '',
      event_time: ev.event_time ?? '',
      venue: ev.venue ?? '',
      member1: members[0] ?? '',
      member2: members[1] ?? '',
      member3: members[2] ?? '',
      criteria_count: ev.criteria_count ?? 4,
    })
    setShowForm(true)
  }

  function resetForm() {
    setShowForm(false)
    setEditId(null)
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? '' })
    setUploadFile(null)
    setMessage('')
  }

  async function handleSave() {
    if (!form.name || !form.category_id) { setMessage('Name and category are required.'); return }
    setSaving(true)
    setMessage('')

    let rulebook_url: string | undefined

    // Upload rulebook if provided
    if (uploadFile) {
      const path = `${Date.now()}-${uploadFile.name.replace(/\s/g, '_')}`
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('rulebooks')
        .upload(path, uploadFile, { upsert: true })
      if (uploadErr) {
        setMessage('Failed to upload rulebook: ' + uploadErr.message)
        setSaving(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('rulebooks').getPublicUrl(path)
      rulebook_url = publicUrl
    }

    const assignedMembers = [form.member1, form.member2, form.member3]
      .map(m => m.trim()).filter(Boolean)

    const payload: any = {
      name: form.name,
      category_id: form.category_id,
      max_entries: form.max_entries,
      is_team_event: form.is_team_event,
      team_size: form.is_team_event ? form.team_size : null,
      event_date: form.event_date || null,
      event_time: form.event_time || null,
      venue: form.venue || null,
      assigned_members: assignedMembers.length > 0 ? assignedMembers : null,
      criteria_count: form.criteria_count || 4,
    }
    if (rulebook_url) payload.rulebook_url = rulebook_url

    if (editId) {
      await supabase.from('events').update(payload).eq('id', editId)
    } else {
      await supabase.from('events').insert(payload)
    }

    setMessage(editId ? 'Event updated!' : 'Event created!')
    await load()
    resetForm()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event? This will also delete all participant entries for it.')) return
    await supabase.from('events').delete().eq('id', id)
    await load()
  }

  const eventsByCategory: Record<string, any[]> = {}
  events.forEach(ev => {
    const cn = ev.category_id ?? 'other'
    if (!eventsByCategory[cn]) eventsByCategory[cn] = []
    eventsByCategory[cn].push(ev)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Events</h2>
          <p className="text-gray-500 text-sm mt-1">Manage sub-events, rulebooks and schedules</p>
        </div>
        <button onClick={() => { setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? '' }); setShowForm(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Event
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card border border-brand-100 bg-brand-50/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">{editId ? 'Edit Event' : 'New Event'}</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Best Speaker" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Entries per School</label>
              <input type="number" min={1} className="input" value={form.max_entries} onChange={e => setForm({ ...form, max_entries: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Number of Judging Criteria</label>
              <input type="number" min={1} max={10} className="input" value={form.criteria_count} onChange={e => setForm({ ...form, criteria_count: +e.target.value })} />
            </div>
            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.is_team_event} onChange={e => setForm({ ...form, is_team_event: e.target.checked })} className="rounded" />
                Team Event
              </label>
              {form.is_team_event && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Team size:</label>
                  <input type="number" min={1} className="input w-20" value={form.team_size} onChange={e => setForm({ ...form, team_size: +e.target.value })} />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" className="input" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
              <input type="text" className="input" value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} placeholder="e.g. 9:00 AM" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
              <input className="input" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} placeholder="e.g. Main Hall" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rulebook PDF</label>
              <input type="file" accept=".pdf" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} className="text-sm text-gray-600" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-2">Assigned Members <span className="text-gray-400 font-normal">(up to 3)</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input className="input" placeholder="Member 1 name" value={form.member1}
                  onChange={e => setForm({ ...form, member1: e.target.value })} />
                <input className="input" placeholder="Member 2 name" value={form.member2}
                  onChange={e => setForm({ ...form, member2: e.target.value })} />
                <input className="input" placeholder="Member 3 name" value={form.member3}
                  onChange={e => setForm({ ...form, member3: e.target.value })} />
              </div>
            </div>
          </div>
          {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={15} /> {saving ? 'Saving…' : 'Save Event'}
            </button>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Events by category — ordered by display_order (A, B, C, D) */}
      {categories.map(cat => {
        const catEvents = eventsByCategory[cat.id] ?? []
        if (catEvents.length === 0) return null
        return (
        <div key={cat.id} className="card">
          <h3 className="text-base font-semibold text-brand-700 mb-3 pb-2 border-b border-gray-100">{cat.name}</h3>
          <div className="space-y-2">
            {catEvents.map(ev => (
              <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-800">{ev.name}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    <span className={`font-medium px-2 py-0.5 rounded-full ${ev.is_team_event ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-600'}`}>
                      {ev.is_team_event ? `Team Evaluation (${ev.team_size} members)` : 'Individual Evaluation'}
                    </span>
                    {ev.venue && <span>📍 {ev.venue}</span>}
                    {ev.event_date && <span>📅 {ev.event_date}</span>}
                    {ev.max_entries > 1 && <span>Max {ev.max_entries} entries</span>}
                    <span>{ev.criteria_count ?? 4} criteria</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(ev)} className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                  <button onClick={() => handleDelete(ev.id)} className="btn-danger text-xs px-3 py-1.5">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}
