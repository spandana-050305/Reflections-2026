'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Pencil, Save, Check } from 'lucide-react'
import type { Category, Event } from '@/lib/types'

export default function AdminManualMarksPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [marksIndex, setMarksIndex] = useState<Set<string>>(new Set()) // event IDs that have marks
  const [eventMarks, setEventMarks] = useState<any[]>([]) // full marks for selected event only

  const [selectedCat, setSelectedCat] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  // draft[slotNumber][entryIndex] = scoreString
  const [draft, setDraft] = useState<Record<number, Record<number, string>>>({})
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showFlash(msg: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(msg)
    flashTimer.current = setTimeout(() => setFlash(''), 3000)
  }

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  async function load() {
    const [
      { data: cats, error: catsErr },
      { data: evs,  error: evsErr  },
      { data: sc,   error: scErr   },
      { data: mk,   error: mkErr   },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*').order('name'),
      supabase.from('schools').select('slot_number, school_name').order('slot_number'),
      supabase.from('marks').select('event_id'),  // lightweight: just IDs for dot indicator
    ])
    const firstErr = catsErr ?? evsErr ?? scErr ?? mkErr
    if (firstErr) { showFlash(`❌ Failed to load: ${firstErr.message}`); return }
    setCategories(cats ?? [])
    setEvents((evs as Event[]) ?? [])
    setSchools(sc ?? [])
    setMarksIndex(new Set((mk ?? []).map((m: any) => m.event_id)))
    if (cats?.[0]) setSelectedCat(prev => prev || cats[0].id)
  }

  useEffect(() => { load() }, [])

  // When event changes, fetch marks for that event only
  useEffect(() => {
    if (!selectedEvent) { setEventMarks([]); return }
    async function fetchMarks() {
      const { data: mk, error: mkErr } = await supabase
        .from('marks').select('*').eq('event_id', selectedEvent!.id)
      if (mkErr) { showFlash(`❌ Failed to load marks: ${mkErr.message}`); return }
      setEventMarks(mk ?? [])
    }
    fetchMarks()
  }, [selectedEvent?.id])

  // Rebuild draft whenever eventMarks or selectedEvent changes
  useEffect(() => {
    if (!selectedEvent) { setDraft({}); return }
    const d: Record<number, Record<number, string>> = {}
    schools.forEach(s => {
      if (!s.slot_number) return  // skip schools with no slot assigned
      d[s.slot_number] = {}
      for (let e = 1; e <= (selectedEvent.max_entries ?? 1); e++) {
        const row = eventMarks.find((m: any) => m.slot_number === s.slot_number && m.entry_index === e)
        d[s.slot_number][e] = row ? String(row.total) : ''
      }
    })
    setDraft(d)
  }, [selectedEvent, eventMarks, schools])

  async function handleSave() {
    if (!selectedEvent) return
    setSaving(true)

    const rows: any[] = []
    for (const [slotStr, entries] of Object.entries(draft)) {
      const slot = Number(slotStr)
      if (!slot || isNaN(slot)) continue  // skip invalid/unassigned slots
      for (const [entryStr, scoreStr] of Object.entries(entries)) {
        const entry = Number(entryStr)
        const total = parseFloat(scoreStr)
        if (!isNaN(total) && scoreStr.trim() !== '') {
          rows.push({
            slot_number: slot,
            event_id: selectedEvent.id,
            entry_index: entry,
            scores: [total],
            total,
          })
        }
      }
    }

    if (rows.length === 0) {
      showFlash('No scores to save.')
      setSaving(false)
      return
    }

    // Delete existing marks for this event, then insert fresh
    const { error: delErr } = await supabase.from('marks').delete().eq('event_id', selectedEvent.id)
    if (delErr) { showFlash('Error saving: ' + delErr.message); setSaving(false); return }

    const { error } = await supabase.from('marks').insert(rows)

    if (error) {
      showFlash('Error saving: ' + error.message)
    } else {
      showFlash('Marks saved ✓')
      const { data: freshMk } = await supabase.from('marks').select('*').eq('event_id', selectedEvent!.id)
      setEventMarks(freshMk ?? [])
      setMarksIndex(prev => new Set([...prev, selectedEvent!.id]))
    }
    setSaving(false)
  }

  async function clearEventMarks() {
    if (!selectedEvent) return
    if (!confirm(`Clear all manual marks for "${selectedEvent.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('marks').delete().eq('event_id', selectedEvent.id)
    if (error) { showFlash(`❌ ${error.message}`); return }
    showFlash('Marks cleared.')
    setEventMarks([])
    setMarksIndex(prev => { const s = new Set(prev); s.delete(selectedEvent!.id); return s })
  }

  const filteredEvents = events.filter(e => e.category_id === selectedCat)
  const maxEntries = selectedEvent?.max_entries ?? 1
  const hasMultiEntry = maxEntries > 1

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Pencil size={20} className="text-brand-600" /> Manual Marks Entry
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          For events that don't use guest judges — enter total scores per slot directly.
          These feed into Results when no guest marks are present for the event.
        </p>
      </div>

      {flash && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 ${flash.startsWith('❌') ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {!flash.startsWith('❌') && <Check size={15} />} {flash}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c.id} onClick={() => { setSelectedCat(c.id); setSelectedEvent(null) }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCat === c.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div className="flex gap-2 flex-wrap">
        {filteredEvents.map(ev => {
          const hasMarks = marksIndex.has(ev.id)
          return (
            <button key={ev.id}
              onClick={() => setSelectedEvent(ev)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border flex items-center gap-1.5 ${selectedEvent?.id === ev.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300'}`}>
              {ev.name}
              {hasMarks && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" title="Has manual marks" />}
            </button>
          )
        })}
      </div>

      {!selectedEvent && (
        <div className="card text-center text-gray-400 py-10">Select an event above to enter marks.</div>
      )}

      {selectedEvent && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-gray-800">{selectedEvent.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Enter total score per slot{hasMultiEntry ? ' and entry' : ''}. Leave blank to skip a slot.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={clearEventMarks} className="btn-danger text-xs px-3 py-1.5">Clear All</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Marks'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-16">Slot</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">School</th>
                  {hasMultiEntry
                    ? Array.from({ length: maxEntries }, (_, i) => (
                        <th key={i} className="text-left px-4 py-2.5 font-semibold text-gray-600">Entry {i + 1} Score</th>
                      ))
                    : <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Score</th>
                  }
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schools.map(s => (
                  <tr key={s.slot_number} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{s.slot_number}</td>
                    <td className="px-4 py-2.5 text-gray-800">{s.school_name}</td>
                    {Array.from({ length: maxEntries }, (_, i) => {
                      const entry = i + 1
                      return (
                        <td key={entry} className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="—"
                            value={draft[s.slot_number]?.[entry] ?? ''}
                            onChange={e => setDraft(d => ({
                              ...d,
                              [s.slot_number]: { ...(d[s.slot_number] ?? {}), [entry]: e.target.value }
                            }))}
                            className="input w-28 py-1 text-sm"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
