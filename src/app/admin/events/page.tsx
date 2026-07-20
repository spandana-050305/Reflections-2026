'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, Save } from 'lucide-react'
import type { Category } from '@/lib/types'
import { parseAssignedMembers } from '@/lib/types'

const DEFAULT_CRITERIA = ['', '', '', '']
const CATEGORY_OPTIONS = ['A', 'B', 'C', 'D']

const EMPTY_FORM = {
  name: '',
  category_id: '',
  max_entries: 1,
  is_team_event: false,
  team_size: 1,
  event_date: '',
  event_time: '',
  venue: '',
  members: [''] as string[],
  criteria: DEFAULT_CRITERIA as string[],
  rules: '',
}

export default function AdminEventsPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Category management state
  const [newCatName, setNewCatName] = useState('A')
  const [addingCat, setAddingCat] = useState(false)

  async function load() {
    const [{ data: cats, error: catsErr }, { data: evs, error: evsErr }] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*, categories(name)').order('name'),
    ])
    const firstErr = catsErr ?? evsErr
    if (firstErr) { setMessage(`❌ Failed to load: ${firstErr.message}`); return }
    setCategories(cats ?? [])
    setEvents(evs ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleAddCategory() {
    const name = newCatName.trim()
    if (!name) return
    setAddingCat(true)
    const displayOrder = CATEGORY_OPTIONS.indexOf(name) + 1
    const { error } = await supabase.from('categories').insert({ name, display_order: displayOrder })
    if (error) { setMessage(`❌ ${error.message}`); setAddingCat(false); return }
    await load()
    setAddingCat(false)
    setMessage(`Category ${name} created!`)
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? All events in this category will also be deleted.`)) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { setMessage(`❌ ${error.message}`); return }
    await load()
  }

  function startEdit(ev: any) {
    setEditId(ev.id)
    const parsedMembers: string[] = parseAssignedMembers(ev.assigned_members)
    const members = parsedMembers.length > 0 ? parsedMembers : ['']
    const criteria: string[] =
      ev.criteria_names && ev.criteria_names.length > 0
        ? ev.criteria_names
        : Array.from({ length: ev.criteria_count ?? 4 }, (_, i) => `Criteria ${i + 1}`)
    setForm({
      name: ev.name,
      category_id: ev.category_id,
      max_entries: ev.max_entries,
      is_team_event: ev.is_team_event,
      team_size: ev.team_size ?? 1,
      event_date: ev.event_date ?? '',
      event_time: ev.event_time ?? '',
      venue: ev.venue ?? '',
      members,
      criteria,
      rules: ev.rules ?? '',
    })
    setShowForm(true)
  }

  function resetForm() {
    setShowForm(false)
    setEditId(null)
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? '' })
    setMessage('')
  }

  function addMember() {
    if (form.members.length >= 5) return
    setForm({ ...form, members: [...form.members, ''] })
  }

  function removeMember(i: number) {
    if (form.members.length <= 1) {
      setForm({ ...form, members: [''] })
      return
    }
    setForm({ ...form, members: form.members.filter((_, j) => j !== i) })
  }

  function updateMember(i: number, val: string) {
    const next = [...form.members]
    next[i] = val
    setForm({ ...form, members: next })
  }

  async function handleSave() {
    if (!form.name || !form.category_id) { setMessage('Name and category are required.'); return }
    setSaving(true)
    setMessage('')

    const assignedMembers = form.members.map(m => m.trim()).filter(Boolean)

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
      criteria_names: form.criteria,
      criteria_count: form.criteria.length || 4,
      rules: form.rules || null,
    }

    if (editId) {
      const { error } = await supabase.from('events').update(payload).eq('id', editId)
      if (error) { setMessage(`❌ ${error.message}`); setSaving(false); return }
    } else {
      const { error } = await supabase.from('events').insert(payload)
      if (error) { setMessage(`❌ ${error.message}`); setSaving(false); return }
    }

    const successMsg = editId ? 'Event updated!' : 'Event created!'
    await load()
    resetForm()
    setMessage(successMsg)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event? This will also delete all participant entries for it.')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { setMessage(`❌ ${error.message}`); return }
    await load()
  }

  const eventsByCategory: Record<string, any[]> = {}
  events.forEach(ev => {
    const cn = ev.category_id ?? 'other'
    if (!eventsByCategory[cn]) eventsByCategory[cn] = []
    eventsByCategory[cn].push(ev)
  })

  // Which category names are already in the DB?
  const existingCatNames = new Set(categories.map(c => c.name))
  const availableCatOptions = CATEGORY_OPTIONS.filter(o => !existingCatNames.has(o))

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

      {message && !showForm && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${message.startsWith('❌') ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Category Management */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Categories</h3>
        </div>

        {/* Existing categories */}
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-full text-sm font-medium text-brand-700">
                Category {cat.name}
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="text-brand-400 hover:text-red-500 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-4">No categories yet. Add one below.</p>
        )}

        {/* Add category */}
        {availableCatOptions.length > 0 ? (
          <div className="flex items-center gap-3">
            <select
              className="input w-32"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
            >
              {availableCatOptions.map(o => (
                <option key={o} value={o}>Category {o}</option>
              ))}
            </select>
            <button onClick={handleAddCategory} disabled={addingCat} className="btn-primary flex items-center gap-2 py-2">
              <Plus size={14} /> {addingCat ? 'Adding…' : 'Add Category'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">All categories (A–D) have been added.</p>
        )}
      </div>

      {/* Event Form */}
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
                {categories.map(c => <option key={c.id} value={c.id}>Category {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Entries per School</label>
              <input type="number" min={1} className="input" value={form.max_entries} onChange={e => setForm({ ...form, max_entries: +e.target.value })} />
            </div>
            <div className="flex items-center gap-4 pt-6">
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
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Rules</label>
              </div>
              <textarea
                className="input"
                rows={3}
                value={form.rules}
                onChange={e => setForm({ ...form, rules: e.target.value })}
                placeholder="Enter event rules visible to schools and judges..."
              />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Judging Criteria</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, criteria: [...form.criteria, ''] })}
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Add Criteria
                </button>
              </div>
              <div className="space-y-2">
                {form.criteria.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="input flex-1"
                      placeholder={`Criteria ${i + 1} name`}
                      value={c}
                      onChange={e => {
                        const next = [...form.criteria]
                        next[i] = e.target.value
                        setForm({ ...form, criteria: next })
                      }}
                    />
                    {form.criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, criteria: form.criteria.filter((_, j) => j !== i) })}
                        className="text-red-400 hover:text-red-600 shrink-0"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">
                  Assigned Members <span className="text-gray-400 font-normal">(all optional)</span>
                </label>
                {form.members.length < 5 && (
                  <button type="button" onClick={addMember} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add member
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {form.members.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="input flex-1"
                      placeholder={`Member ${i + 1} name (optional)`}
                      value={m}
                      onChange={e => updateMember(i, e.target.value)}
                    />
                    {form.members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMember(i)}
                        className="text-red-400 hover:text-red-600 shrink-0"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
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
            <h3 className="text-base font-semibold text-brand-700 mb-3 pb-2 border-b border-gray-100">Category {cat.name}</h3>
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
                      <span>{ev.criteria_names?.length ?? ev.criteria_count ?? 4} criteria</span>
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
