'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ChevronDown, ChevronRight, Trophy, Users, AlertCircle, ClipboardCheck } from 'lucide-react'
import type { Category, Event } from '@/lib/types'

const eKey = (slot: number, entry: number) => `${slot}_${entry}`

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

export default function AdminGuestMarksPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [guestMarks, setGuestMarks] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [results, setResults] = useState<Record<string, any>>({})

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [flashMsg, setFlashMsg] = useState('')
  const [computeTarget, setComputeTarget] = useState<string | null>(null)

  function flash(msg: string) { setFlashMsg(msg); setTimeout(() => setFlashMsg(''), 3500) }

  async function load() {
    const [{ data: cats }, { data: evs }, { data: gm }, { data: parts }, { data: resultData }] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*').order('name'),
      supabase.from('guest_marks').select('*'),
      supabase.from('participants').select('slot_number, event_id, entry_index, member_index, participant_name').order('entry_index').order('member_index'),
      supabase.from('results').select('*'),
    ])
    setCategories(cats ?? [])
    setEvents((evs as Event[]) ?? [])
    if (cats?.[0]) setSelectedCat(cats[0].id)
    setGuestMarks(gm ?? [])
    setParticipants(parts ?? [])
    const res: Record<string, any> = {}
    ;(resultData ?? []).forEach((r: any) => { res[r.event_id] = r })
    setResults(res)
  }

  useEffect(() => { load() }, [])

  // namesByEvent[eventId][slot_entry] = "names joined"
  const namesByEvent = useMemo(() => {
    const grouped: Record<string, Record<number, Record<number, string[]>>> = {}
    participants.forEach((p: any) => {
      if (!grouped[p.event_id]) grouped[p.event_id] = {}
      if (!grouped[p.event_id][p.slot_number]) grouped[p.event_id][p.slot_number] = {}
      if (!grouped[p.event_id][p.slot_number][p.entry_index]) grouped[p.event_id][p.slot_number][p.entry_index] = []
      grouped[p.event_id][p.slot_number][p.entry_index].push(p.participant_name)
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

  function markFor(eventId: string, judgeNumber: number, slot: number, entry: number) {
    return guestMarks.find(m => m.event_id === eventId && m.judge_number === judgeNumber && m.slot_number === slot && m.entry_index === entry)
  }

  function avgTotal(eventId: string, slot: number, entry: number): number | null {
    const rows = guestMarks.filter(m => m.event_id === eventId && m.slot_number === slot && m.entry_index === entry)
    if (rows.length === 0) return null
    const sum = rows.reduce((a, r) => a + (Number(r.judge_total) || 0), 0)
    return Math.round((sum / rows.length) * 100) / 100
  }

  async function computeWinners(eventId: string) {
    setSaving(true)
    const entries = entriesForEvent(eventId)
    type SE = { slot: number; entry: number; total: number; names: string }
    const seList: SE[] = entries.map(({ slot, entry }) => ({
      slot, entry,
      total: avgTotal(eventId, slot, entry) ?? 0,
      names: namesByEvent[eventId]?.[eKey(slot, entry)] ?? '',
    }))
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
    await load()
    flash('Winners computed from guest marks ✓')
    setSaving(false)
    setComputeTarget(null)
  }

  const filteredEvents = selectedCat ? events.filter(e => e.category_id === selectedCat) : events

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={22} className="text-brand-600" /> Guest Marks
        </h2>
        <p className="text-sm text-gray-500">Marks submitted by guest evaluators, averaged across judges</p>
      </div>

      {flashMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-xl text-sm font-medium">{flashMsg}</div>
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
        const isOpen = expanded.has(ev.id)
        const judges = judgesForEvent(ev.id)
        const entries = entriesForEvent(ev.id)
        const result = results[ev.id]
        const winnerGroups: WinnerGroup[] = result?.winners_json
          ? (() => { try { return JSON.parse(result.winners_json) } catch { return [] } })() : []

        return (
          <div key={ev.id} className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(s => { const n = new Set(s); n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id); return n })}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-gray-900">{ev.name}</span>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Users size={10} /> {judges.length} judge{judges.length === 1 ? '' : 's'} submitted
                </span>
                {result && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Winners computed</span>
                )}
              </div>
              {isOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
            </div>

            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                {entries.length === 0 ? (
                  <div className="text-center text-gray-400 py-8 text-sm">No guest marks submitted for this event yet.</div>
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
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(({ slot, entry }) => {
                          const names = namesByEvent[ev.id]?.[eKey(slot, entry)] ?? ''
                          const avg = avgTotal(ev.id, slot, entry)
                          return (
                            <tr key={eKey(slot, entry)} className="hover:bg-gray-50">
                              <td className="px-3 py-2 border border-gray-100 font-medium text-gray-700">{slot}</td>
                              <td className="px-3 py-2 border border-gray-100 text-gray-800">{names || '—'}</td>
                              {judges.map(j => {
                                const m = markFor(ev.id, j.judge_number, slot, entry)
                                return (
                                  <td key={j.judge_number} className="px-3 py-2 border border-gray-100 text-center text-gray-700"
                                    title={m ? `Criteria: ${(m.criteria_scores ?? []).join(', ')}` : 'Not submitted'}>
                                    {m ? m.judge_total : <span className="text-gray-300">—</span>}
                                  </td>
                                )
                              })}
                              <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-gray-900">{avg ?? '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {entries.length > 0 && (
                  <button onClick={() => setComputeTarget(ev.id)} disabled={saving} className="btn-primary flex items-center gap-2">
                    <Trophy size={14} /> Compute Winners
                  </button>
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

      {computeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
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
    </div>
  )
}
