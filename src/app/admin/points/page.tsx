'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { TableProperties } from 'lucide-react'

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

function awardPoints(
  results: any[],
  pts: { p1: number; p2: number; p3: number },
  filterEventIds?: Set<string>
): Record<number, number> {
  const map: Record<number, number> = {}
  const rankPts: Record<number, number> = { 1: pts.p1, 2: pts.p2, 3: pts.p3 }

  results.forEach((r: any) => {
    if (filterEventIds && !filterEventIds.has(r.event_id)) return

    if (r.winners_json) {
      let groups: WinnerGroup[] = []
      try { groups = JSON.parse(r.winners_json) } catch { /* ignore */ }
      groups.forEach(g => {
        const p = rankPts[g.rank]
        if (!p) return
        g.entries.forEach(e => { map[e.slot] = (map[e.slot] ?? 0) + p })
      })
    } else {
      if (r.first_slot  != null) map[r.first_slot]  = (map[r.first_slot]  ?? 0) + pts.p1
      if (r.second_slot != null) map[r.second_slot] = (map[r.second_slot] ?? 0) + pts.p2
      if (r.third_slot  != null) map[r.third_slot]  = (map[r.third_slot]  ?? 0) + pts.p3
    }
  })
  return map
}

function buildRankedRows(
  pointMap: Record<number, number>,
  schools: any[]
) {
  const sorted = Object.entries(pointMap)
    .map(([slot, total]) => ({
      slot: +slot,
      total: total as number,
      school: schools.find((s: any) => s.slot_number === +slot)?.school_name ?? '—',
    }))
    .sort((a, b) => b.total - a.total)

  let rank = 1
  return sorted.map((row, idx) => {
    if (idx > 0 && row.total < sorted[idx - 1].total) rank = idx + 1
    return { ...row, rank }
  })
}

const rankEmoji = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : String(r)

export default function AdminPointsPage() {
  const supabase = createClient()

  const [results,    setResults]    = useState<any[]>([])
  const [schools,    setSchools]    = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [events,     setEvents]     = useState<any[]>([])
  const [view,       setView]       = useState('overall')

  // Points settings (read-only here — configure in Marks page)
  const [pts, setPts] = useState({ p1: 15, p2: 10, p3: 5 })

  async function load() {
    const [
      { data: res }, { data: sc }, { data: cats },
      { data: evs }, { data: stg },
    ] = await Promise.all([
      supabase.from('results').select('*'),
      supabase.from('schools').select('slot_number, school_name').order('slot_number'),
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('id, category_id, name'),
      supabase.from('settings').select('*').single(),
    ])
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

  const overallMap = awardPoints(results, pts)
  const overallSorted = buildRankedRows(overallMap, schools)

  const catRows: Record<string, ReturnType<typeof buildRankedRows>> = {}
  categories.forEach((c: any) => {
    const ids = new Set(events.filter((e: any) => e.category_id === c.id).map((e: any) => e.id))
    catRows[c.id] = buildRankedRows(awardPoints(results, pts, ids), schools)
  })

  const totalFinalized = results.length
  const totalPublished = results.filter((r: any) => r.published).length

  const renderTable = (rows: ReturnType<typeof buildRankedRows>) => (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left py-2 px-3 text-gray-500 font-medium">Rank</th>
          <th className="text-left py-2 px-3 text-gray-500 font-medium">Slot</th>
          <th className="text-left py-2 px-3 text-gray-500 font-medium">School</th>
          <th className="text-left py-2 px-3 text-gray-500 font-medium">Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.slot} className={`border-b border-gray-50 hover:bg-gray-50 ${row.rank <= 3 ? 'font-medium' : ''}`}>
            <td className="py-2.5 px-3">{rankEmoji(row.rank)}</td>
            <td className="py-2.5 px-3 text-gray-700">Slot {row.slot}</td>
            <td className="py-2.5 px-3 text-gray-800">{row.school}</td>
            <td className="py-2.5 px-3 text-brand-700 font-bold">{row.total}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="py-8 text-center text-gray-400">No results finalized yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <TableProperties className="text-brand-600" size={24} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Points Table</h2>
          <p className="text-gray-500 text-sm">
            1st = {pts.p1} pts · 2nd = {pts.p2} pts · 3rd = {pts.p3} pts · ties share the same rank
            <span className="text-gray-400"> · Configure in Marks → Set Points</span>
          </p>
        </div>
      </div>

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
            Finalize marks in the Marks section to populate this table.
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

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 text-left px-4 py-3 font-semibold text-gray-600 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">School</th>
                {(view === 'overall' ? events : events.filter(e => e.category_id === view)).map((ev: any) => (
                  <th key={ev.id} className="px-3 py-3 font-semibold text-gray-600 text-center whitespace-nowrap">{ev.name}</th>
                ))}
                <th className="px-4 py-3 font-semibold text-gray-800 text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(() => {
                const displayEvs = view === 'overall' ? events : events.filter(e => e.category_id === view)

                // Rows stay fixed by slot number (descending) — only the event
                // columns scroll/slide horizontally, the row order never changes.
                const schoolRows = [...schools]
                  .sort((a: any, b: any) => (b.slot_number ?? -Infinity) - (a.slot_number ?? -Infinity))
                  .map((school: any) => {
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

                return schoolRows.map(({ school, rowTotal, evPtsMap }) => (
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
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{rowTotal || '—'}</td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
