'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Pencil, Save, Check, Trophy, Eye, EyeOff } from 'lucide-react'
import type { Category, Event } from '@/lib/types'
import PageSpinner from '@/components/layout/PageSpinner'

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

export default function AdminManualMarksPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [marksIndex, setMarksIndex] = useState<Set<string>>(new Set())
  const [eventMarks, setEventMarks] = useState<any[]>([])
  const [results, setResults] = useState<Record<string, any>>({}) // eventId → result row

  const [selectedCat, setSelectedCat] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const [draft, setDraft] = useState<Record<number, Record<number, string>>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [flash, setFlash] = useState('')
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showFlash(msg: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(msg)
    flashTimer.current = setTimeout(() => setFlash(''), 3500)
  }

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  async function load() {
    const [
      { data: cats, error: catsErr },
      { data: evs,  error: evsErr  },
      { data: sc,   error: scErr   },
      { data: mk,   error: mkErr   },
      { data: res,  error: resErr  },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*').order('name'),
      supabase.from('schools').select('slot_number, school_name').order('slot_number'),
      supabase.from('marks').select('event_id'),
      supabase.from('results').select('*'),
    ])
    const firstErr = catsErr ?? evsErr ?? scErr ?? mkErr ?? resErr
    if (firstErr) { showFlash(`❌ Failed to load: ${firstErr.message}`); setLoading(false); return }
    setCategories(cats ?? [])
    setEvents((evs as Event[]) ?? [])
    setSchools(sc ?? [])
    setMarksIndex(new Set((mk ?? []).map((m: any) => m.event_id)))
    const resMap: Record<string, any> = {}
    ;(res ?? []).forEach((r: any) => { resMap[r.event_id] = r })
    setResults(resMap)
    if (cats?.[0]) setSelectedCat(prev => prev || cats[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!selectedEvent) { setEventMarks([]); return }
    supabase.from('marks').select('*').eq('event_id', selectedEvent.id)
      .then(({ data, error }) => {
        if (error) { showFlash(`❌ ${error.message}`); return }
        setEventMarks(data ?? [])
      })
  }, [selectedEvent?.id])

  useEffect(() => {
    if (!selectedEvent) { setDraft({}); return }
    const d: Record<number, Record<number, string>> = {}
    schools.forEach(s => {
      if (!s.slot_number) return
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
      if (!slot || isNaN(slot)) continue
      for (const [entryStr, scoreStr] of Object.entries(entries)) {
        const entry = Number(entryStr)
        const total = parseFloat(scoreStr)
        if (!isNaN(total) && scoreStr.trim() !== '') {
          rows.push({ slot_number: slot, event_id: selectedEvent.id, entry_index: entry, scores: [total], total })
        }
      }
    }

    if (rows.length === 0) { showFlash('No scores to save.'); setSaving(false); return }

    const { error: delErr } = await supabase.from('marks').delete().eq('event_id', selectedEvent.id)
    if (delErr) { showFlash('Error saving: ' + delErr.message); setSaving(false); return }

    const { error } = await supabase.from('marks').insert(rows)
    if (error) { showFlash('Error saving: ' + error.message); setSaving(false); return }

    showFlash('Marks saved ✓')
    const { data: freshMk } = await supabase.from('marks').select('*').eq('event_id', selectedEvent.id)
    setEventMarks(freshMk ?? [])
    setMarksIndex(prev => new Set([...prev, selectedEvent.id]))
    setSaving(false)
  }

  async function handleComputeWinners() {
    if (!selectedEvent) return
    setComputing(true)

    const eventMarkRows = eventMarks.length > 0
      ? eventMarks
      : (await supabase.from('marks').select('*').eq('event_id', selectedEvent.id)).data ?? []

    if (eventMarkRows.length === 0) {
      showFlash('❌ No marks saved yet. Save marks first.')
      setComputing(false)
      return
    }

    const sorted = [...eventMarkRows].sort((a, b) => Number(b.total) - Number(a.total))
    const groups: WinnerGroup[] = []
    let rank = 1, i = 0
    while (i < sorted.length && groups.length < 3) {
      const tied = sorted.filter(x => Number(x.total) === Number(sorted[i].total))
      groups.push({
        rank,
        total: Number(sorted[i].total),
        entries: tied.map(x => ({ slot: x.slot_number, entry: x.entry_index ?? 1, names: '' }))
      })
      rank += tied.length; i += tied.length
    }

    const { error } = await supabase.from('results').upsert({
      event_id: selectedEvent.id,
      first_slot: groups[0]?.entries[0]?.slot ?? null,
      second_slot: groups[1]?.entries[0]?.slot ?? null,
      third_slot: groups[2]?.entries[0]?.slot ?? null,
      winners_json: JSON.stringify(groups),
      published: false,
    }, { onConflict: 'event_id' })

    if (error) { showFlash(`❌ ${error.message}`); setComputing(false); return }

    showFlash('Winners computed ✓')
    await load()
    setComputing(false)
  }

  async function togglePublish() {
    if (!selectedEvent) return
    const result = results[selectedEvent.id]
    if (!result) return
    setPublishing(true)
    const { error } = await supabase.from('results')
      .update({ published: !result.published })
      .eq('event_id', selectedEvent.id)
    if (error) { showFlash(`❌ ${error.message}`); setPublishing(false); return }
    showFlash(result.published ? 'Result unpublished.' : 'Result published to schools ✓')
    await load()
    setPublishing(false)
  }

  async function clearEventMarks() {
    if (!selectedEvent) return
    if (!confirm(`Clear all marks for "${selectedEvent.name}"? This cannot be undone.`)) return
    const { error: e1 } = await supabase.from('marks').delete().eq('event_id', selectedEvent.id)
    if (e1) { showFlash('❌ Error clearing marks: ' + e1.message); return }
    const { error: e2 } = await supabase.from('results').delete().eq('event_id', selectedEvent.id)
    if (e2) { showFlash('❌ Error clearing results: ' + e2.message); return }
    showFlash('Marks and result cleared.')
    setEventMarks([])
    setMarksIndex(prev => { const s = new Set(prev); s.delete(selectedEvent.id); return s })
    await load()
  }

  if (loading) return <PageSpinner />

  const filteredEvents = events.filter(e => e.category_id === selectedCat)
  const maxEntries = selectedEvent?.max_entries ?? 1
  const hasMultiEntry = maxEntries > 1

  const hasMarks = selectedEvent ? marksIndex.has(selectedEvent.id) : false
  const result = selectedEvent ? results[selectedEvent.id] : null
  const isPublished = result?.published ?? false

  function parseWinners(r: any): WinnerGroup[] {
    if (!r?.winners_json) return []
    try { return JSON.parse(r.winners_json) } catch { return [] }
  }
  const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Pencil size={20} className="text-brand-600" /> Manual Marks
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          For events without guest judges — enter scores, compute winners, then publish results.
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
          const hasMk = marksIndex.has(ev.id)
          const res = results[ev.id]
          return (
            <button key={ev.id}
              onClick={() => setSelectedEvent(ev)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border flex items-center gap-1.5 ${selectedEvent?.id === ev.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300'}`}>
              {ev.name}
              {hasMk && !res && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" title="Marks saved, not computed" />}
              {res && !res.published && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" title="Winners computed, not published" />}
              {res?.published && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Published" />}
            </button>
          )
        })}
      </div>

      {!selectedEvent && (
        <div className="card text-center text-gray-400 py-10">Select an event above to enter marks.</div>
      )}

      {selectedEvent && (
        <div className="card space-y-4">
          {/* Header + action buttons */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-gray-800">{selectedEvent.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Enter total score per slot{hasMultiEntry ? ' and entry' : ''}. Leave blank to skip.
              </p>
            </div>

            {/* Step-by-step action buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={clearEventMarks} className="btn-danger text-xs px-3 py-1.5">Clear All</button>

              {/* Step 1: Save */}
              <button onClick={handleSave} disabled={saving} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
                <Save size={13} /> {saving ? 'Saving…' : 'Save Marks'}
              </button>

              {/* Step 2: Compute Winners (only if marks exist) */}
              {hasMarks && (
                <button onClick={handleComputeWinners} disabled={computing} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
                  <Trophy size={13} /> {computing ? 'Computing…' : result ? 'Re-compute' : 'Compute Winners'}
                </button>
              )}

              {/* Step 3: Publish / Unpublish (only if result exists) */}
              {result && (
                <button onClick={togglePublish} disabled={publishing}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 ${isPublished ? 'btn-danger' : 'btn-primary'}`}>
                  {isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
                  {publishing ? '…' : isPublished ? 'Unpublish' : 'Publish Results'}
                </button>
              )}
            </div>
          </div>

          {/* Scores table */}
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
                {schools.filter(s => s.slot_number).map(s => (
                  <tr key={s.slot_number} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{s.slot_number}</td>
                    <td className="px-4 py-2.5 text-gray-800">{s.school_name}</td>
                    {Array.from({ length: maxEntries }, (_, i) => {
                      const entry = i + 1
                      return (
                        <td key={entry} className="px-4 py-2.5">
                          <input
                            type="number" min={0} step={0.01} placeholder="—"
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

          {/* Winners summary (shown when computed) */}
          {result && (() => {
            const groups = parseWinners(result)
            if (groups.length === 0) return null
            return (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className={`px-4 py-2.5 flex items-center justify-between ${isPublished ? 'bg-green-50' : 'bg-blue-50'}`}>
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Trophy size={14} className="text-brand-600" /> Computed Winners
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPublished ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {isPublished ? '✓ Published' : 'Draft'}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {groups.map(g => (
                    <div key={g.rank} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-lg">{MEDALS[g.rank] ?? `#${g.rank}`}</span>
                      <div>
                        {g.entries.map((e, i) => {
                          const school = schools.find(s => s.slot_number === e.slot)
                          return (
                            <p key={i} className="text-sm font-medium text-gray-800">
                              Slot {e.slot}{school ? ` — ${school.school_name}` : ''}
                              <span className="text-xs text-gray-400 ml-2">({g.total} pts)</span>
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
