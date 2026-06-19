'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Lock, Unlock, Trophy, ChevronDown, ChevronRight, AlertCircle, Clock, Settings2, Save, Users } from 'lucide-react'
import type { Category, Event } from '@/lib/types'

// ─── Key helpers ────────────────────────────────────────────────────────────
// Each (slot, entry) combination has a unique key within an event
const mKey = (slot: number, entry: number) => `${slot}_${entry}`
const entryLabel = (slot: number, entry: number, total: number) =>
  total > 1 ? `Slot ${slot} Entry ${entry}` : `Slot ${slot}`

// ─── Types ──────────────────────────────────────────────────────────────────
interface SlotEntry { entry: number; names: string }
interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

export default function AdminMarksPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('')

  // marks[eventId][mKey(slot,entry)] = scores[]
  const [marks, setMarks] = useState<Record<string, Record<string, number[]>>>({})
  // finalizedSlots[eventId][slot] = bool  (per-slot, not per-entry)
  const [finalizedSlots, setFinalizedSlots] = useState<Record<string, Record<number, boolean>>>({})
  // eventCols[eventId] = number of score columns
  const [eventCols, setEventCols] = useState<Record<string, number>>({})
  // results[eventId] = result object
  const [results, setResults] = useState<Record<string, any>>({})
  // slotEntries[eventId][slot] = [{entry, names}]
  const [slotEntries, setSlotEntries] = useState<Record<string, Record<number, SlotEntry[]>>>({})

  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [flashMsg, setFlashMsg] = useState('')

  // Points settings
  const [pts, setPts] = useState({ p1: 15, p2: 10, p3: 5 })
  const [draftPts, setDraftPts] = useState({ p1: 15, p2: 10, p3: 5 })
  const [showPtsPanel, setShowPtsPanel] = useState(false)
  const [savingPts, setSavingPts] = useState(false)

  // Modals
  const [finalizeEventTarget, setFinalizeEventTarget] = useState<string | null>(null)
  const [unlockEventTarget, setUnlockEventTarget] = useState<string | null>(null)
  const [computeTarget, setComputeTarget] = useState<string | null>(null)
  const [computeText, setComputeText] = useState('')
  const [fullUnlockTarget, setFullUnlockTarget] = useState<string | null>(null)
  const [fullUnlockText, setFullUnlockText] = useState('')

  function flash(msg: string) { setFlashMsg(msg); setTimeout(() => setFlashMsg(''), 3500) }

  async function savePoints() {
    setSavingPts(true)
    await supabase.from('settings').update({ points_1st: draftPts.p1, points_2nd: draftPts.p2, points_3rd: draftPts.p3 })
    setPts({ ...draftPts })
    setShowPtsPanel(false)
    flash(`Points updated: 1st=${draftPts.p1} · 2nd=${draftPts.p2} · 3rd=${draftPts.p3}`)
    setSavingPts(false)
  }

  // ─── Load all data ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadBase() {
      const [{ data: cats }, { data: evs }, { data: sc }, { data: stg }] = await Promise.all([
        supabase.from('categories').select('*').order('display_order'),
        supabase.from('events').select('*').order('name'),
        supabase.from('schools').select('slot_number, school_name').order('slot_number'),
        supabase.from('settings').select('*').single(),
      ])
      setCategories(cats ?? [])
      setEvents(evs ?? [])
      setSchools(sc ?? [])
      if (cats?.[0]) setSelectedCat(cats[0].id)
      if (stg) {
        const p = { p1: stg.points_1st ?? 15, p2: stg.points_2nd ?? 10, p3: stg.points_3rd ?? 5 }
        setPts(p); setDraftPts(p)
      }
    }
    loadBase()
  }, [])

  useEffect(() => {
    if (schools.length === 0 || events.length === 0) return
    loadAll()
  }, [schools.length, events.length])

  async function loadAll() {
    const [{ data: markData }, { data: resultData }, { data: participantData }] = await Promise.all([
      supabase.from('marks').select('*'),
      supabase.from('results').select('*'),
      supabase.from('participants').select('slot_number, event_id, entry_index, member_index, participant_name').order('entry_index').order('member_index'),
    ])

    // ── Build slotEntries from participants ──────────────────────────────────
    // slotEntries[eventId][slot] = [{entry, names}]  (grouped by entry_index)
    const se: Record<string, Record<number, Record<number, string[]>>> = {}
    ;(participantData ?? []).forEach((p: any) => {
      if (!se[p.event_id]) se[p.event_id] = {}
      if (!se[p.event_id][p.slot_number]) se[p.event_id][p.slot_number] = {}
      if (!se[p.event_id][p.slot_number][p.entry_index]) se[p.event_id][p.slot_number][p.entry_index] = []
      se[p.event_id][p.slot_number][p.entry_index].push(p.participant_name)
    })
    // Convert to SlotEntry[]
    const seClean: Record<string, Record<number, SlotEntry[]>> = {}
    Object.keys(se).forEach(eid => {
      seClean[eid] = {}
      Object.keys(se[eid]).forEach(slot => {
        seClean[eid][+slot] = Object.entries(se[eid][+slot])
          .sort((a, b) => +a[0] - +b[0])
          .map(([entryIdx, names]) => ({ entry: +entryIdx, names: names.join(', ') }))
      })
    })
    setSlotEntries(seClean)

    // ── Build marks state ─────────────────────────────────────────────────────
    const mks: Record<string, Record<string, number[]>> = {}
    const fin: Record<string, Record<number, boolean>> = {}
    const cols: Record<string, number> = {}

    ;(markData ?? []).forEach((row: any) => {
      const entry = row.entry_index ?? 1
      const key = mKey(row.slot_number, entry)
      if (!mks[row.event_id]) mks[row.event_id] = {}
      if (!fin[row.event_id]) fin[row.event_id] = {}
      mks[row.event_id][key] = [...(row.scores ?? [])]
      // finalized is per-slot: set true only if this slot's finalized flag is true
      if (row.finalized) fin[row.event_id][row.slot_number] = true
      cols[row.event_id] = Math.max(cols[row.event_id] ?? 1, row.scores?.length ?? 1)
    })

    // Fill in missing slots/entries
    events.forEach(ev => {
      if (!mks[ev.id]) mks[ev.id] = {}
      if (!fin[ev.id]) fin[ev.id] = {}
      if (!cols[ev.id]) cols[ev.id] = 1
      schools.forEach(s => {
        const entries = seClean[ev.id]?.[s.slot_number] ?? [{ entry: 1, names: '' }]
        entries.forEach(({ entry }) => {
          const key = mKey(s.slot_number, entry)
          if (!mks[ev.id][key]) mks[ev.id][key] = Array(cols[ev.id]).fill(0)
        })
      })
    })

    const res: Record<string, any> = {}
    ;(resultData ?? []).forEach((r: any) => { res[r.event_id] = r })

    setMarks(mks)
    setFinalizedSlots(fin)
    setEventCols(cols)
    setResults(res)
  }

  async function saveMarks(eventId: string) {
    setSaving(true)
    const numCols = eventCols[eventId] ?? 1
    const entries = slotEntries[eventId] ?? {}
    for (const s of schools) {
      const slotEntriesForSchool = entries[s.slot_number] ?? [{ entry: 1, names: '' }]
      for (const { entry } of slotEntriesForSchool) {
        const key = mKey(s.slot_number, entry)
        const scores = (marks[eventId]?.[key] ?? []).slice(0, numCols).map(v => Number(v) || 0)
        const total = scores.reduce((a, b) => a + b, 0)
        await supabase.from('marks').upsert({
          slot_number: s.slot_number,
          event_id: eventId,
          entry_index: entry,
          scores,
          total,
          finalized: !!finalizedSlots[eventId]?.[s.slot_number],
        }, { onConflict: ['slot_number', 'event_id', 'entry_index'] })
      }
    }
    flash('Marks saved ✓')
    setSaving(false)
  }

  async function saveMarksWithFin(eventId: string, fin: Record<number, boolean>) {
    const numCols = eventCols[eventId] ?? 1
    const entries = slotEntries[eventId] ?? {}
    for (const s of schools) {
      const slotEntriesForSchool = entries[s.slot_number] ?? [{ entry: 1, names: '' }]
      for (const { entry } of slotEntriesForSchool) {
        const key = mKey(s.slot_number, entry)
        const scores = (marks[eventId]?.[key] ?? []).slice(0, numCols).map(v => Number(v) || 0)
        const total = scores.reduce((a, b) => a + b, 0)
        await supabase.from('marks').upsert({
          slot_number: s.slot_number, event_id: eventId, entry_index: entry,
          scores, total, finalized: !!fin[s.slot_number],
        }, { onConflict: ['slot_number', 'event_id', 'entry_index'] })
      }
    }
  }

  async function finalizeAllSlots(eventId: string) {
    setSaving(true)
    const newFin = { ...finalizedSlots, [eventId]: {} as Record<number, boolean> }
    schools.forEach(s => { newFin[eventId][s.slot_number] = true })
    setFinalizedSlots(newFin)
    await saveMarksWithFin(eventId, newFin[eventId])
    flash('All slots finalized ✓')
    setSaving(false)
    setFinalizeEventTarget(null)
  }

  async function unlockSlot(eventId: string, slot: number) {
    const newFin = { ...finalizedSlots, [eventId]: { ...finalizedSlots[eventId], [slot]: false } }
    setFinalizedSlots(newFin)
    await supabase.from('marks').upsert(
      (slotEntries[eventId]?.[slot] ?? [{ entry: 1, names: '' }]).map(({ entry }) => ({
        slot_number: slot, event_id: eventId, entry_index: entry,
        scores: marks[eventId]?.[mKey(slot, entry)] ?? [],
        total: (marks[eventId]?.[mKey(slot, entry)] ?? []).reduce((a: number, b: number) => a + b, 0),
        finalized: false,
      })),
      { onConflict: ['slot_number', 'event_id', 'entry_index'] }
    )
    setUnlockEventTarget(null)
    flash('Slot unlocked ✓')
  }

  async function computeWinners(eventId: string) {
    setSaving(true)
    const entries = slotEntries[eventId] ?? {}
    type SE = { slot: number; entry: number; total: number; names: string }
    const seList: SE[] = []
    schools.forEach(s => {
      const slotEntriesForSchool = entries[s.slot_number] ?? [{ entry: 1, names: '' }]
      slotEntriesForSchool.forEach(({ entry, names }) => {
        const key = mKey(s.slot_number, entry)
        const total = (marks[eventId]?.[key] ?? []).reduce((a: number, b: number) => a + (Number(b) || 0), 0)
        seList.push({ slot: s.slot_number, entry, total, names })
      })
    })
    seList.sort((a, b) => b.total - a.total)
    const groups: WinnerGroup[] = []
    let rank = 1, i = 0
    while (i < seList.length && groups.length < 3) {
      const tied = seList.filter(x => x.total === seList[i].total)
      groups.push({ rank, total: seList[i].total, entries: tied.map(x => ({ slot: x.slot, entry: x.entry, names: x.names })) })
      rank += tied.length; i += tied.length
    }
    await supabase.from('results').upsert({
      event_id: eventId,
      first_slot: groups[0]?.entries[0]?.slot ?? null,
      second_slot: groups[1]?.entries[0]?.slot ?? null,
      third_slot: groups[2]?.entries[0]?.slot ?? null,
      winners_json: JSON.stringify(groups),
      published: false,
    }, { onConflict: ['event_id'] })
    await loadAll()
    flash('Winners computed ✓')
    setSaving(false)
    setComputeTarget(null)
  }

  async function fullUnlock(eventId: string) {
    setSaving(true)
    const newFin = { ...finalizedSlots, [eventId]: {} as Record<number, boolean> }
    schools.forEach(s => { newFin[eventId][s.slot_number] = false })
    setFinalizedSlots(newFin)
    await saveMarksWithFin(eventId, newFin[eventId])
    await supabase.from('results').delete().eq('event_id', eventId)
    await loadAll()
    flash('Fully unlocked ✓')
    setSaving(false)
    setFullUnlockTarget(null)
  }

  const filteredEvents = selectedCat ? events.filter(e => e.category_id === selectedCat) : events

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy size={22} className="text-brand-600" /> Marks
        </h2>
        <button onClick={() => setShowPtsPanel(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
          <Settings2 size={15} /> Points Config
        </button>
      </div>

      {flashMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-xl text-sm font-medium">{flashMsg}</div>
      )}

      {showPtsPanel && (
        <div className="card flex flex-wrap items-end gap-4">
          {(['p1','p2','p3'] as const).map((k, i) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{i+1}{i===0?'st':i===1?'nd':'rd'} place pts</label>
              <input type="number" min={0} value={draftPts[k]}
                onChange={e => setDraftPts(v => ({ ...v, [k]: +e.target.value }))}
                className="input w-20" />
            </div>
          ))}
          <button onClick={savePoints} disabled={savingPts} className="btn-primary">{savingPts ? 'Saving…' : 'Save'}</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c.id} onClick={() => setSelectedCat(c.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCat===c.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {c.name}
          </button>
        ))}
      </div>

      {filteredEvents.map(ev => {
        const isOpen = expandedEvents.has(ev.id)
        const numCols = eventCols[ev.id] ?? 1
        const allFinalized = schools.every(s => finalizedSlots[ev.id]?.[s.slot_number])
        const result = results[ev.id]
        const winnerGroups: WinnerGroup[] = result?.winners_json
          ? (() => { try { return JSON.parse(result.winners_json) } catch { return [] } })() : []

        return (
          <div key={ev.id} className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedEvents(s => { const n = new Set(s); n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id); return n })}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-gray-900">{ev.name}</span>
                {ev.is_team_event && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Team Event</span>}
                {allFinalized && result
                  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Lock size={10} /> Finalized</span>
                  : allFinalized ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Marks locked</span> : null}
              </div>
              {isOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
            </div>

            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 font-medium">Score columns:</label>
                  <input type="number" min={1} max={10} value={numCols}
                    onChange={e => setEventCols(v => ({ ...v, [ev.id]: Math.max(1, +e.target.value) }))}
                    disabled={allFinalized} className="input w-16 text-center" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">School</th>
                        {Array.from({ length: numCols }, (_, i) => (
                          <th key={i} className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Score {i+1}</th>
                        ))}
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Total</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map(s => {
                        const slotEntriesForSchool = slotEntries[ev.id]?.[s.slot_number] ?? [{ entry: 1, names: '' }]
                        const isSlotFinalized = !!finalizedSlots[ev.id]?.[s.slot_number]
                        return slotEntriesForSchool.map(({ entry, names }) => {
                          const key = mKey(s.slot_number, entry)
                          const scores = marks[ev.id]?.[key] ?? []
                          const total = scores.reduce((a: number, b: number) => a + (Number(b) || 0), 0)
                          const label = entryLabel(s.slot_number, entry, slotEntriesForSchool.length)
                          const displayNames = ev.is_team_event && names
                            ? (() => { const ms = names.split(', '); return ms.length > 1 ? `${ms[0]} +${ms.length-1} more` : ms[0] })()
                            : names
                          return (
                            <tr key={key} className={`${isSlotFinalized ? 'bg-gray-50/60' : ''} hover:bg-gray-50`}>
                              <td className="px-3 py-2 border border-gray-100">
                                <p className="font-medium text-gray-800">{label}</p>
                                <p className="text-xs text-gray-400">{s.school_name}</p>
                                {displayNames && (
                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                    {ev.is_team_event ? <><Users size={9} className="text-violet-400" />{displayNames}</> : `↳ ${displayNames}`}
                                  </span>
                                )}
                              </td>
                              {Array.from({ length: numCols }, (_, ci) => (
                                <td key={ci} className="px-2 py-1.5 border border-gray-100">
                                  <input type="number" min={0}
                                    value={scores[ci] || ''}
                                    placeholder="0"
                                    disabled={isSlotFinalized}
                                    onChange={e => {
                                      const v = e.target.value === '' ? 0 : Number(e.target.value)
                                      setMarks(prev => {
                                        const newScores = [...(prev[ev.id]?.[key] ?? Array(numCols).fill(0))]
                                        newScores[ci] = v
                                        return { ...prev, [ev.id]: { ...prev[ev.id], [key]: newScores } }
                                      })
                                    }}
                                    className="input w-16 text-center py-1"
                                  />
                                </td>
                              ))}
                              <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-gray-800">{total || '—'}</td>
                              <td className="px-3 py-2 border border-gray-100 text-center">
                                {isSlotFinalized
                                  ? <span className="flex items-center justify-center gap-1 text-xs text-green-600"><Lock size={11} />Locked</span>
                                  : <button onClick={() => unlockSlot(ev.id, s.slot_number)} className="text-xs text-amber-600 hover:underline flex items-center gap-1 mx-auto"><Unlock size={11} />Unlock</button>
                                }
                              </td>
                            </tr>
                          )
                        })
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={() => saveMarks(ev.id)} disabled={saving || allFinalized} className="btn-primary flex items-center gap-2">
                    <Save size={14} />{saving ? 'Saving…' : 'Save Marks'}
                  </button>
                  {!allFinalized && (
                    <button onClick={() => setFinalizeEventTarget(ev.id)} className="btn-secondary flex items-center gap-2">
                      <Lock size={14} />Finalize All
                    </button>
                  )}
                  {allFinalized && !result && (
                    <button onClick={() => setComputeTarget(ev.id)} className="btn-primary flex items-center gap-2">
                      <Trophy size={14} />Compute Winners
                    </button>
                  )}
                  {result && (
                    <button onClick={() => setFullUnlockTarget(ev.id)} className="btn-danger flex items-center gap-2">
                      <Unlock size={14} />Full Unlock
                    </button>
                  )}
                </div>

                {winnerGroups.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Computed Winners</p>
                    {winnerGroups.map(g => (
                      <div key={g.rank} className="flex items-center gap-2 text-sm">
                        <span className="text-base">{g.rank===1?'🥇':g.rank===2?'🥈':'🥉'}</span>
                        <span className="font-medium">{g.entries.map(e => `Slot ${e.slot}${e.names ? ` — ${e.names}` : ''}`).join(', ')}</span>
                        <span className="text-gray-400">({g.total} pts)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {finalizeEventTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={22} />
              <p className="font-semibold text-gray-900">Finalize all slots?</p>
            </div>
            <p className="text-sm text-gray-500">This locks marks for all schools in this event.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => finalizeAllSlots(finalizeEventTarget)} className="btn-primary flex-1">Finalize</button>
              <button onClick={() => setFinalizeEventTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {computeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <p className="font-semibold text-gray-900">Compute winners for this event?</p>
            <p className="text-sm text-gray-500">Rankings calculated from saved marks. Results won't be published automatically.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => computeWinners(computeTarget)} className="btn-primary flex-1">Compute</button>
              <button onClick={() => setComputeTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {fullUnlockTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={22} />
              <p className="font-semibold text-gray-900">Full unlock?</p>
            </div>
            <p className="text-sm text-gray-500">Clears finalized status and deletes computed winners. Cannot be undone.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => fullUnlock(fullUnlockTarget)} className="btn-danger flex-1">Unlock Everything</button>
              <button onClick={() => setFullUnlockTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
