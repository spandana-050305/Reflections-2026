'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { TableProperties } from 'lucide-react'

export default function AdminPointsPage() {
  const supabase = createClient()

  const [results,    setResults]    = useState<any[]>([])
  const [schools,    setSchools]    = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [events,     setEvents]     = useState<any[]>([])
  const [view,       setView]       = useState('overall')

  // Points settings (read-only here — configure in Marks page)
  const [pts, setPts] = useState({ p1: 15, p2: 10, p3: 5 })
  const [loadError, setLoadError] = useState('')

  async function load() {
    const [
      { data: res, error: resErr },
      { data: sc,  error: scErr  },
      { data: cats,error: catsErr},
      { data: evs, error: evsErr },
      { data: stg, error: stgErr },
    ] = await Promise.all([
      supabase.from('results').select('*'),
      supabase.from('schools').select('slot_number, school_name').order('slot_number'),
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('id, category_id, name'),
      supabase.from('settings').select('*').single(),
    ])
    const firstErr = resErr ?? scErr ?? catsErr ?? evsErr ?? stgErr
    if (firstErr) { setLoadError(`❌ Failed to load: ${firstErr.message}`); return }
    setResults(res ?? [])
    setSchools(sc ?? [])
    setCategories(cats ?? [])
    setEvents(evs ?? [])
    if (stg) {
      const p = {
        p1: stg.points_1st ?? 15,
        p2: stg.points_2nd ?? 10,
        p3: stg.points_3rd ?? 5,
      }
      setPts(p)
    }
  }

  useEffect(() => { load() }, [])

  const totalFinalized = results.length
  const totalPublished = results.filter((r: any) => r.published).length

  // ── Points per school for the current view ───────────────────────────────
  const displayEvs = view === 'overall' ? events : events.filter(e => e.category_id === view)

  const schoolRows = schools.map((school: any) => {
    let rowTotal = 0
    const evPtsMap: Record<string, number> = {}
    displayEvs.forEach((ev: any) => {
      const result = results.find((r: any) => r.event_id === ev.id)
      let evPts = 0
      if (result?.winners_json) {
        try {
          const groups = JSON.parse(result.winners_json)
          groups.forEach((g: any) => {
            if (g.entries.some((e: any) => e.slot === school.slot_number)) {
              if (g.rank === 1) evPts = pts.p1
              else if (g.rank === 2) evPts = pts.p2
              else if (g.rank === 3) evPts = pts.p3
            }
          })
        } catch {}
      }
      evPtsMap[ev.id] = evPts
      rowTotal += evPts
    })
    return { school, rowTotal, evPtsMap }
  })

  // Table keeps a fixed slot-descending order; only event columns scroll.
  const tableRows = [...schoolRows].sort(
    (a, b) => (b.school.slot_number ?? -Infinity) - (a.school.slot_number ?? -Infinity)
  )

  // Podium: rank by total points (descending), ties share a rank.
  const ranked = [...schoolRows].filter(r => r.rowTotal > 0).sort((a, b) => b.rowTotal - a.rowTotal)
  let curRank = 0, prevTotal: number | null = null
  const standings = ranked.map((r, i) => {
    if (prevTotal === null || r.rowTotal < prevTotal) { curRank = i + 1; prevTotal = r.rowTotal }
    return { ...r, rank: curRank }
  })
  const podium = [1, 2, 3].map(rank => ({ rank, rows: standings.filter(s => s.rank === rank) }))
  const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : '🥉'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <TableProperties className="text-brand-600" size={24} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Points Table</h2>
          <p className="text-gray-500 text-sm">
            1st = {pts.p1} pts · 2nd = {pts.p2} pts · 3rd = {pts.p3} pts · ties share the same rank
            <span className="text-gray-400"> · Configure in Guest Marks → Points Config</span>
          </p>
        </div>
      </div>

      {loadError && (
        <div className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 border border-red-100 text-red-600">{loadError}</div>
      )}

      {/* Info bar */}
      <div className="flex gap-3 text-sm flex-wrap">
        <div className="bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 text-brand-700">
          <span className="font-semibold">{totalFinalized}</span> events finalized
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-green-700">
          <span className="font-semibold">{totalPublished}</span> results published
        </div>
        {totalFinalized === 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-700 text-xs">
            Lock all marks and Compute Winners in the Guest Marks section to populate this table.
          </div>
        )}
      </div>

      {/* View tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setView('overall')}
          className={`px-4 py-2 rounded-full text-sm font-medium ${view === 'overall' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          Overall
        </button>
        {categories.map((c: any) => (
          <button
            key={c.id}
            onClick={() => setView(c.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${view === c.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Podium — top 3 for the current view */}
      {standings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {podium.map(({ rank, rows }) => (
            <div
              key={rank}
              className={`stat-card text-center ${rank === 1 ? 'ring-2 ring-amber-200' : ''}`}
            >
              <div className="text-3xl">{medal(rank)}</div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-1">
                {rank === 1 ? '1st Place' : rank === 2 ? '2nd Place' : '3rd Place'}
              </p>
              {rows.length === 0 ? (
                <p className="text-sm text-gray-300 mt-2">—</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {rows.map(({ school, rowTotal }) => (
                    <div key={school.slot_number}>
                      <p className="font-semibold text-gray-800 leading-tight">{school.school_name}</p>
                      <p className="text-xs text-gray-400">Slot {school.slot_number} · <span className="text-brand-600 font-semibold">{rowTotal} pts</span></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 text-left px-4 py-3 font-semibold text-gray-600 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">School</th>
                {displayEvs.map((ev: any) => (
                  <th key={ev.id} className="px-3 py-3 font-semibold text-gray-600 text-center whitespace-nowrap">{ev.name}</th>
                ))}
                <th className="sticky right-0 z-20 bg-gray-50 px-4 py-3 font-semibold text-gray-800 text-center shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tableRows.map(({ school, rowTotal, evPtsMap }) => (
                <tr key={school.slot_number} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-gray-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    <p>{school.school_name}</p>
                    <p className="text-xs text-gray-400">Slot {school.slot_number}</p>
                  </td>
                  {displayEvs.map((ev: any) => {
                    const evPts = evPtsMap[ev.id] ?? 0
                    return (
                      <td key={ev.id} className="px-3 py-3 text-center">
                        {evPts > 0 ? <span className="font-semibold text-brand-700">+{evPts}</span> : <span className="text-gray-300">—</span>}
                      </td>
                    )
                  })}
                  <td className="sticky right-0 z-10 bg-white px-4 py-3 text-center font-bold text-gray-900 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]">{rowTotal || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
