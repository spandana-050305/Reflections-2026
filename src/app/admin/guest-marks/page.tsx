'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  ChevronDown, ChevronRight, Trophy, Users, AlertCircle, ClipboardCheck,
  Pencil, Lock, Unlock, Settings2, ShieldCheck,
} from 'lucide-react'
import type { Category, Event } from '@/lib/types'
import PageSpinner from '@/components/layout/PageSpinner'

const eKey = (slot: number, entry: number) => `${slot}_${entry}`

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

export default function AdminGuestMarksPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [guestMarks, setGuestMarks] = useState<any[]>([])
  const [manualMarks, setManualMarks] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [results, setResults] = useState<Record<string, any>>({})

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flashMsg, setFlashMsg] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const selectedCatRef = useRef(selectedCat)
  const [computeTarget, setComputeTarget] = useState<string | null>(null)
  const [lockAllTarget, setLockAllTarget] = useState<string | null>(null)
  const [fullUnlockTarget, setFullUnlockTarget] = useState<string | null>(null)

  // Unlock password gate
  const [unlockPassword, setUnlockPassword] = useState('')
  const [pwPrompt, setPwPrompt] = useState<{ kind: 'entry' | 'full'; eventId: string; slot?: number; entry?: number } | null>(null)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')

  // Points settings (place points)
  const [draftPts, setDraftPts] = useState({ p1: 15, p2: 10, p3: 5 })
  const [showPtsPanel, setShowPtsPanel] = useState(false)
  const [savingPts, setSavingPts] = useState(false)

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    eventId: string
    judgeNumber: number
    judgeName: string
    slot: number
    entry: number
    scores: number[]
  } | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  function flash(msg: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlashMsg(msg)
    flashTimer.current = setTimeout(() => setFlashMsg(''), 3500)
  }

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  // Load small/static tables: categories, events, results, settings
  async function loadBase(): Promise<{ cats: Category[]; evs: Event[] } | null> {
    const [
      { data: cats, error: catsErr },
      { data: evs,  error: evsErr  },
      { data: resultData, error: resErr },
      { data: stg,  error: stgErr  },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*').order('name'),
      supabase.from('results').select('*'),
      supabase.from('settings').select('*').maybeSingle(),
    ])
    const firstErr = catsErr ?? evsErr ?? resErr ?? stgErr
    if (firstErr) { flash(`❌ Failed to load: ${firstErr.message}`); return null }
    setCategories(cats ?? [])
    setEvents((evs as Event[]) ?? [])
    const res: Record<string, any> = {}
    ;(resultData ?? []).forEach((r: any) => { res[r.event_id] = r })
    setResults(res)
    if (stg) {
      setDraftPts({ p1: stg.points_1st ?? 15, p2: stg.points_2nd ?? 10, p3: stg.points_3rd ?? 5 })
      setUnlockPassword(stg.unlock_password ?? '')
    }
    return { cats: cats ?? [], evs: (evs as Event[]) ?? [] }
  }

  // Load marks only for events in the selected category — much faster than fetching all rows
  async function loadCategory(catId: string, evList?: Event[]) {
    const allEvents = evList ?? events
    const catEventIds = allEvents.filter(e => e.category_id === catId).map(e => e.id)
    if (catEventIds.length === 0) {
      setGuestMarks([]); setManualMarks([]); setParticipants([])
      return
    }
    const res = await fetch('/api/admin/load-guest-marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds: catEventIds }),
    })
    if (!res.ok) { flash('❌ Failed to load marks'); return }
    const { marks, manualMarks: mm, participants: parts } = await res.json()
    setGuestMarks(marks ?? [])
    setManualMarks(mm ?? [])
    setParticipants(parts ?? [])
  }

  // After mutations: reload results + current category marks (no need to re-fetch cats/events)
  async function reload() {
    await Promise.all([loadBase(), loadCategory(selectedCatRef.current)])
    setLastRefreshed(new Date())
  }

  // Keep ref in sync so the interval always uses the latest selected category
  useEffect(() => { selectedCatRef.current = selectedCat }, [selectedCat])

  useEffect(() => {
    async function init() {
      const base = await loadBase()
      if (!base) { setLoading(false); return }
      const { cats, evs } = base
      const firstCat = cats[0]?.id
      if (firstCat) {
        setSelectedCat(firstCat)
        selectedCatRef.current = firstCat
        await loadCategory(firstCat, evs)
      }
      setLastRefreshed(new Date())
      setLoading(false)
    }
    init()
    refreshTimer.current = setInterval(reload, 30000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [])

  async function savePoints() {
    setSavingPts(true)
    const res = await fetch('/api/admin/update-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points_1st: draftPts.p1, points_2nd: draftPts.p2, points_3rd: draftPts.p3 }),
    })
    setSavingPts(false)
    if (!res.ok) { const j = await res.json(); flash(`❌ ${j.error ?? 'Failed to save points'}`); return }
    setShowPtsPanel(false)
    flash(`Points updated: 1st=${draftPts.p1} · 2nd=${draftPts.p2} · 3rd=${draftPts.p3}`)
  }

  // namesByEvent[eventId][slot_entry] = "names joined"
  const namesByEvent = useMemo(() => {
    const grouped: Record<string, Record<number, Record<number, string[]>>> = {}
    participants.forEach((p: any) => {
      if (!grouped[p.event_id]) grouped[p.event_id] = {}
      if (!grouped[p.event_id][p.slot_number]) grouped[p.event_id][p.slot_number] = {}
      const ei = p.entry_index ?? 1
      if (!grouped[p.event_id][p.slot_number][ei]) grouped[p.event_id][p.slot_number][ei] = []
      grouped[p.event_id][p.slot_number][ei].push(p.participant_name)
    })
    const out: Record<string, Record<string, string>> = {}
    Object.entries(grouped).forEach(([eid, slots]) => {
      out[eid] = {}
      Object.entries(slots).forEach(([slot, entries]) => {
        Object.entries(entries).forEach(([entry, names]) => {
          out[eid][eKey(+slot, +entry)] = names.join(', ')
        })
      })
    })
    return out
  }, [participants])

  // Per event: list of judge numbers that have submitted, and a lookup of marks.
  function judgesForEvent(eventId: string): { judge_number: number; judge_name: string }[] {
    const map = new Map<number, string>()
    guestMarks.filter(m => m.event_id === eventId).forEach(m => map.set(m.judge_number, m.judge_name))
    return Array.from(map.entries()).map(([judge_number, judge_name]) => ({ judge_number, judge_name })).sort((a, b) => a.judge_number - b.judge_number)
  }

  // Entries (slot/entry combos) that have at least one guest mark for this event.
  function entriesForEvent(eventId: string): { slot: number; entry: number }[] {
    const seen = new Set<string>()
    const out: { slot: number; entry: number }[] = []
    guestMarks.filter(m => m.event_id === eventId).forEach(m => {
      const key = eKey(m.slot_number, m.entry_index)
      if (!seen.has(key)) { seen.add(key); out.push({ slot: m.slot_number, entry: m.entry_index }) }
    })
    return out.sort((a, b) => a.slot - b.slot || a.entry - b.entry)
  }

  function rowsFor(eventId: string, slot: number, entry: number) {
    return guestMarks.filter(m => m.event_id === eventId && m.slot_number === slot && m.entry_index === entry)
  }

  function markFor(eventId: string, judgeNumber: number, slot: number, entry: number) {
    return guestMarks.find(m => m.event_id === eventId && m.judge_number === judgeNumber && m.slot_number === slot && m.entry_index === entry)
  }

  function avgTotal(eventId: string, slot: number, entry: number): number | null {
    const rows = rowsFor(eventId, slot, entry)
    if (rows.length === 0) return null
    const sum = rows.reduce((a, r) => a + (Number(r.judge_total) || 0), 0)
    return Math.round((sum / rows.length) * 100) / 100
  }

  // ── Lock helpers ───────────────────────────────────────────────────────────
  function isEntryLocked(eventId: string, slot: number, entry: number): boolean {
    const rows = rowsFor(eventId, slot, entry)
    return rows.length > 0 && rows.every(r => r.locked === true)
  }
  function allEntriesLocked(eventId: string): boolean {
    const entries = entriesForEvent(eventId)
    return entries.length > 0 && entries.every(({ slot, entry }) => isEntryLocked(eventId, slot, entry))
  }

  async function setEntryLock(eventId: string, slot: number, entry: number, locked: boolean): Promise<string | null> {
    const rows = rowsFor(eventId, slot, entry)
    for (const r of rows) {
      const { error } = await supabase.from('guest_marks').upsert({
        event_id: eventId, judge_number: r.judge_number, judge_name: r.judge_name,
        slot_number: slot, entry_index: entry,
        criteria_scores: r.criteria_scores, judge_total: r.judge_total, locked,
      }, { onConflict: 'event_id,judge_number,slot_number,entry_index' })
      if (error) return error.message
    }
    return null
  }

  async function lockEntry(eventId: string, slot: number, entry: number) {
    setSaving(true)
    const err = await setEntryLock(eventId, slot, entry, true)
    if (err) { flash(`❌ ${err}`); setSaving(false); return }
    await reload()
    flash(`Slot ${slot} locked ✓`)
    setSaving(false)
  }

  async function unlockEntry(eventId: string, slot: number, entry: number) {
    setSaving(true)
    const err = await setEntryLock(eventId, slot, entry, false)
    if (err) { flash(`❌ ${err}`); setSaving(false); return }
    await reload()
    flash(`Slot ${slot} unlocked ✓`)
    setSaving(false)
  }

  async function lockAll(eventId: string) {
    setSaving(true)
    for (const { slot, entry } of entriesForEvent(eventId)) {
      const err = await setEntryLock(eventId, slot, entry, true)
      if (err) { flash(`❌ ${err}`); setSaving(false); return }
    }
    await reload()
    flash('All marks locked ✓')
    setSaving(false)
    setLockAllTarget(null)
  }

  async function fullUnlock(eventId: string) {
    setSaving(true)
    for (const { slot, entry } of entriesForEvent(eventId)) {
      const err = await setEntryLock(eventId, slot, entry, false)
      if (err) { flash(`❌ ${err}`); setSaving(false); return }
    }
    const { error: delErr } = await supabase.from('results').delete().eq('event_id', eventId)
    if (delErr) { flash(`❌ ${delErr.message}`); setSaving(false); return }
    await reload()
    flash('Fully unlocked ✓')
    setSaving(false)
    setFullUnlockTarget(null)
  }

  // ── Password-gated unlock actions ───────────────────────────────────────────
  function requestUnlockEntry(eventId: string, slot: number, entry: number) {
    if (!unlockPassword) { unlockEntry(eventId, slot, entry); return }
    setPwInput(''); setPwError(''); setPwPrompt({ kind: 'entry', eventId, slot, entry })
  }

  function requestFullUnlock(eventId: string) {
    if (!unlockPassword) { setFullUnlockTarget(eventId); return }
    setPwInput(''); setPwError(''); setPwPrompt({ kind: 'full', eventId })
  }

  function confirmPassword() {
    if (!pwPrompt) return
    if (pwInput.trim() !== unlockPassword) { setPwError('Incorrect password.'); return }
    const p = pwPrompt
    setPwPrompt(null)
    if (p.kind === 'entry' && p.slot != null && p.entry != null) unlockEntry(p.eventId, p.slot, p.entry)
    else if (p.kind === 'full') fullUnlock(p.eventId)
  }

  async function saveEditedMark() {
    if (!editModal) return
    setEditSaving(true)
    const { eventId, judgeNumber, judgeName: jName, slot, entry, scores } = editModal
    const judgeTotal = scores.reduce((a, b) => a + (Number(b) || 0), 0)
    const { error } = await supabase.from('guest_marks').upsert({
      event_id: eventId,
      judge_number: judgeNumber,
      judge_name: jName,
      slot_number: slot,
      entry_index: entry,
      criteria_scores: scores,
      judge_total: judgeTotal,
      locked: false,
    }, { onConflict: 'event_id,judge_number,slot_number,entry_index' })
    setEditSaving(false)
    if (error) { flash(`❌ ${error.message}`); return }
    await reload()
    flash('Marks updated ✓')
    setEditModal(null)
  }

  async function computeWinners(eventId: string) {
    setSaving(true)
    type SE = { slot: number; entry: number; total: number; names: string }
    let seList: SE[]

    const guestEntries = entriesForEvent(eventId)

    if (guestEntries.length > 0) {
      // Use guest marks (averaged across judges)
      seList = guestEntries.map(({ slot, entry }) => ({
        slot, entry,
        total: avgTotal(eventId, slot, entry) ?? 0,
        names: namesByEvent[eventId]?.[eKey(slot, entry)] ?? '',
      }))
    } else {
      // Fall back to manual marks from the marks table
      const eventManualMarks = manualMarks.filter(m => m.event_id === eventId)
      if (eventManualMarks.length === 0) {
        flash('No marks found — enter guest marks or manual marks first.')
        setSaving(false)
        return
      }
      seList = eventManualMarks.map((m: any) => ({
        slot: m.slot_number,
        entry: m.entry_index ?? 1,
        total: Number(m.total) || 0,
        names: namesByEvent[eventId]?.[eKey(m.slot_number, m.entry_index ?? 1)] ?? '',
      }))
    }
    seList.sort((a, b) => b.total - a.total)
    const groups: WinnerGroup[] = []
    let rank = 1, i = 0
    while (i < seList.length && groups.length < 3) {
      const tied = seList.filter(x => x.total === seList[i].total)
      groups.push({ rank, total: seList[i].total, entries: tied.map(x => ({ slot: x.slot, entry: x.entry, names: x.names })) })
      rank += 1; i += tied.length
    }
    const { error: upsertErr } = await supabase.from('results').upsert({
      event_id: eventId,
      first_slot: groups[0]?.entries[0]?.slot ?? null,
      second_slot: groups[1]?.entries[0]?.slot ?? null,
      third_slot: groups[2]?.entries[0]?.slot ?? null,
      winners_json: JSON.stringify(groups),
      published: false,
    }, { onConflict: 'event_id' })
    setSaving(false)
    if (upsertErr) { flash(`❌ ${upsertErr.message}`); return }
    await reload()
    flash('Winners computed from guest marks ✓')
    setComputeTarget(null)
  }

  if (loading) return <PageSpinner />

  const filteredEvents = selectedCat ? events.filter(e => e.category_id === selectedCat) : events

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck size={22} className="text-brand-600" /> Guest Marks
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Marks submitted by judges, averaged · lock to finalize
            {lastRefreshed && <span className="ml-2 text-xs text-gray-400">· Auto-refreshes every 30s · Last: {lastRefreshed.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={() => setShowPtsPanel(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
          <Settings2 size={15} /> Points Config
        </button>
      </div>

      {flashMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${flashMsg.startsWith('❌') ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-green-50 border border-green-200 text-green-700'}`}>{flashMsg}</div>
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
          <button key={c.id} onClick={() => { setSelectedCat(c.id); loadCategory(c.id) }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCat===c.id ? 'bg-brand-600 text-white shadow-glow' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}>
            {c.name}
          </button>
        ))}
      </div>

      {filteredEvents.map(ev => {
        const isOpen = expanded.has(ev.id)
        const judges = judgesForEvent(ev.id)
        const entries = entriesForEvent(ev.id)
        const result = results[ev.id]
        const allLocked = allEntriesLocked(ev.id)
        const winnerGroups: WinnerGroup[] = result?.winners_json
          ? (() => { try { return JSON.parse(result.winners_json) } catch { return [] } })() : []
        const hasManualMarks = manualMarks.some(m => m.event_id === ev.id)

        return (
          <div key={ev.id} className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(s => { const n = new Set(s); n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id); return n })}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-gray-900">{ev.name}</span>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Users size={10} /> {judges.length} judge{judges.length === 1 ? '' : 's'} submitted
                </span>
                {entries.length > 0 && allLocked && (
                  result
                    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Lock size={10} /> Finalized</span>
                    : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Lock size={10} /> Marks locked</span>
                )}
                {hasManualMarks && entries.length === 0 && (
                  result
                    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Lock size={10} /> Finalized</span>
                    : <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Pencil size={10} /> Manual marks</span>
                )}
              </div>
              {isOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
            </div>

            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                {entries.length === 0 ? (
                  <div className="text-center text-gray-400 py-8 text-sm space-y-3">
                    <p>No guest marks submitted for this event yet.</p>
                    {hasManualMarks && !result && (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-purple-600 text-xs font-medium">Manual marks have been entered for this event.</p>
                        <button onClick={() => setComputeTarget(ev.id)} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                          <Trophy size={14} /> Compute Winners from Manual Marks
                        </button>
                      </div>
                    )}
                    {result && hasManualMarks && entries.length === 0 && (
                      <button onClick={() => requestFullUnlock(ev.id)} disabled={saving} className="btn-danger flex items-center gap-2 mx-auto text-sm">
                        <Unlock size={14} /> Full Unlock
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">Slot</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">Participant</th>
                          {judges.map(j => (
                            <th key={j.judge_number} className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">
                              Judge {j.judge_number}
                              <div className="text-[10px] text-gray-400 font-normal">{j.judge_name}</div>
                            </th>
                          ))}
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Avg Total</th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(({ slot, entry }) => {
                          const names = namesByEvent[ev.id]?.[eKey(slot, entry)] ?? ''
                          const avg = avgTotal(ev.id, slot, entry)
                          const locked = isEntryLocked(ev.id, slot, entry)
                          return (
                            <tr key={eKey(slot, entry)} className={locked ? 'bg-gray-50/60' : 'hover:bg-gray-50'}>
                              <td className="px-3 py-2 border border-gray-100 font-medium text-gray-700">{slot}</td>
                              <td className="px-3 py-2 border border-gray-100 text-gray-800">{names || '—'}</td>
                              {judges.map(j => {
                                const m = markFor(ev.id, j.judge_number, slot, entry)
                                return (
                                  <td key={j.judge_number} className="px-3 py-2 border border-gray-100 text-center text-gray-700">
                                    {m ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span title={`Criteria: ${(m.criteria_scores ?? []).join(', ')}`}>{m.judge_total}</span>
                                        {!locked && (
                                          <button
                                            onClick={() => setEditModal({ eventId: ev.id, judgeNumber: j.judge_number, judgeName: j.judge_name, slot, entry, scores: [...(m.criteria_scores ?? [])] })}
                                            className="text-amber-500 hover:text-amber-700"
                                            title="Edit marks"
                                          >
                                            <Pencil size={12} />
                                          </button>
                                        )}
                                      </div>
                                    ) : <span className="text-gray-300">—</span>}
                                  </td>
                                )
                              })}
                              <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-gray-900">{avg ?? '—'}</td>
                              <td className="px-3 py-2 border border-gray-100 text-center">
                                {locked
                                  ? <button onClick={() => requestUnlockEntry(ev.id, slot, entry)} disabled={saving} className="text-xs text-amber-600 hover:underline flex items-center gap-1 mx-auto"><Unlock size={11} />Unlock</button>
                                  : <button onClick={() => lockEntry(ev.id, slot, entry)} disabled={saving} className="text-xs text-gray-500 hover:text-brand-600 hover:underline flex items-center gap-1 mx-auto"><Lock size={11} />Lock</button>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {entries.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {!allLocked && (
                      <button onClick={() => setLockAllTarget(ev.id)} disabled={saving} className="btn-secondary flex items-center gap-2">
                        <Lock size={14} /> Lock All
                      </button>
                    )}
                    {allLocked && !result && (
                      <button onClick={() => setComputeTarget(ev.id)} disabled={saving} className="btn-primary flex items-center gap-2">
                        <Trophy size={14} /> Compute Winners
                      </button>
                    )}
                    {result && (
                      <button onClick={() => requestFullUnlock(ev.id)} disabled={saving} className="btn-danger flex items-center gap-2">
                        <Unlock size={14} /> Full Unlock
                      </button>
                    )}
                  </div>
                )}

                {entries.length > 0 && !allLocked && (
                  <p className="text-xs text-gray-400">Lock all marks to compute winners.</p>
                )}

                {winnerGroups.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Computed Winners</p>
                    {winnerGroups.map(g => (
                      <div key={g.rank} className="flex items-center gap-2 text-sm">
                        <span className="text-base">{g.rank===1?'🥇':g.rank===2?'🥈':'🥉'}</span>
                        <span className="font-medium">{g.entries.map(e => `Slot ${e.slot}${e.names ? ` — ${e.names}` : ''}`).join(', ')}</span>
                        <span className="text-gray-400">({g.total} avg pts)</span>
                      </div>
                    ))}
                    <p className="text-xs text-amber-600">Use the Results page to publish/unpublish these winners.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {filteredEvents.length === 0 && (
        <div className="card text-center text-gray-400 py-10">No events in this category.</div>
      )}

      {lockAllTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={22} />
              <p className="font-semibold text-gray-900">Lock all marks?</p>
            </div>
            <p className="text-sm text-gray-500">This locks every judge's marks for this event so they can't be edited. You can unlock individual slots or use Full Unlock later.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => lockAll(lockAllTarget)} className="btn-primary flex-1">Lock All</button>
              <button onClick={() => setLockAllTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {computeTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={22} />
              <p className="font-semibold text-gray-900">Compute winners for this event?</p>
            </div>
            <p className="text-sm text-gray-500">Rankings are based on each entry's average total across all judges who submitted. This overwrites any existing result for this event.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => computeWinners(computeTarget)} className="btn-primary flex-1">Compute</button>
              <button onClick={() => setComputeTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {fullUnlockTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={22} />
              <p className="font-semibold text-gray-900">Full unlock?</p>
            </div>
            <p className="text-sm text-gray-500">Unlocks all marks and deletes the computed winners for this event. Cannot be undone.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => fullUnlock(fullUnlockTarget)} className="btn-danger flex-1">Unlock Everything</button>
              <button onClick={() => setFullUnlockTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Password prompt for unlock / full unlock */}
      {pwPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-brand-600 shrink-0" size={22} />
              <p className="font-semibold text-gray-900">
                {pwPrompt.kind === 'full' ? 'Full unlock — enter password' : 'Unlock — enter password'}
              </p>
            </div>
            <p className="text-sm text-gray-500">
              {pwPrompt.kind === 'full'
                ? 'This unlocks every slot and deletes the computed winners for this event.'
                : `Unlock Slot ${pwPrompt.slot}'s marks so they can be edited again.`}
            </p>
            <input
              type="password"
              autoFocus
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError('') }}
              onKeyDown={e => { if (e.key === 'Enter') confirmPassword() }}
              className="input"
              placeholder="Unlock password"
            />
            {pwError && <p className="text-sm text-red-600">{pwError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={confirmPassword} className={`flex-1 ${pwPrompt.kind === 'full' ? 'btn-danger' : 'btn-primary'}`}>Confirm</button>
              <button onClick={() => setPwPrompt(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit judge marks modal */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 animate-scale-in">
            <div>
              <h3 className="font-semibold text-gray-900">Edit Marks — Judge {editModal.judgeNumber}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{editModal.judgeName} · Slot {editModal.slot}, Entry {editModal.entry}</p>
            </div>
            <div className="space-y-3">
              {editModal.scores.map((val, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <label className="text-sm text-gray-600">Criteria {i + 1}</label>
                  <input
                    type="number"
                    min={0}
                    value={val || ''}
                    placeholder="0"
                    onChange={e => {
                      const next = [...editModal.scores]
                      next[i] = e.target.value === '' ? 0 : Number(e.target.value)
                      setEditModal({ ...editModal, scores: next })
                    }}
                    className="input w-20 text-center"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">New total: {editModal.scores.reduce((a, b) => a + (Number(b) || 0), 0)}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={saveEditedMark} disabled={editSaving} className="btn-primary flex-1">
                {editSaving ? 'Saving…' : 'Save Marks'}
              </button>
              <button onClick={() => setEditModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
