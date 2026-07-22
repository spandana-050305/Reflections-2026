'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Trophy, RefreshCw, Wifi } from 'lucide-react'

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const RANK_LABELS: Record<number, string> = { 1: 'First Place', 2: 'Second Place', 3: 'Third Place' }
const RANK_BG: Record<number, string> = {
  1: 'bg-amber-50 border-amber-200',
  2: 'bg-slate-50 border-slate-200',
  3: 'bg-orange-50 border-orange-200',
}

function parseWinners(r: any): WinnerGroup[] {
  if (r?.winners_json) {
    try { return JSON.parse(r.winners_json) } catch { /* ignore */ }
  }
  const groups: WinnerGroup[] = []
  const slots = [r?.first_slot, r?.second_slot, r?.third_slot]
  slots.forEach((slot, i) => {
    if (slot != null) groups.push({ rank: i + 1, total: 0, entries: [{ slot, entry: 1, names: '' }] })
  })
  return groups
}

export default function PublicResultsPage() {
  const supabase = createClient()
  const [results, setResults] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [tick, setTick] = useState(30)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    const [{ data: res }, { data: sc }] = await Promise.all([
      supabase
        .from('results')
        .select('*, events(name, categories(name, display_order))')
        .eq('published', true),
      supabase.from('schools').select('slot_number, school_name'),
    ])
    setResults(res ?? [])
    setSchools(sc ?? [])
    setLastRefreshed(new Date())
    setTick(30)
    setLoading(false)
  }

  useEffect(() => {
    load()
    refreshTimer.current = setInterval(load, 30000)
    tickTimer.current = setInterval(() => setTick(t => (t > 0 ? t - 1 : 30)), 1000)
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
      if (tickTimer.current) clearInterval(tickTimer.current)
    }
  }, [])

  function getSchoolName(slot: number): string {
    return schools.find(s => s.slot_number === slot)?.school_name ?? `Slot ${slot}`
  }

  // Group by category
  const catOrder: Record<string, number> = {}
  const byCat: Record<string, any[]> = {}
  results.forEach((r: any) => {
    const name = r.events?.categories?.name ?? 'Other'
    if (!byCat[name]) { byCat[name] = []; catOrder[name] = r.events?.categories?.display_order ?? 999 }
    byCat[name].push(r)
  })
  const sortedCats = Object.keys(byCat).sort((a, b) => (catOrder[a] ?? 999) - (catOrder[b] ?? 999))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="text-amber-400" size={26} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Live Results</h1>
              <p className="text-xs text-slate-400">Reflections Cultural Fest · Published Results</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Wifi size={12} className="text-green-400 animate-pulse" />
              <span>Auto-refresh in {tick}s</span>
              {lastRefreshed && <span>· {lastRefreshed.toLocaleTimeString()}</span>}
            </div>
            <button onClick={load} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Refresh now">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading results…</p>
          </div>
        ) : sortedCats.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <Trophy size={48} className="mx-auto text-slate-600" />
            <p className="text-xl font-semibold text-slate-300">No results published yet</p>
            <p className="text-slate-500 text-sm">Check back soon — results will appear here as they're released.</p>
          </div>
        ) : (
          sortedCats.map(catName => (
            <div key={catName}>
              {/* Category heading */}
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-white/10" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 px-3">{catName}</h2>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {byCat[catName].map((r: any) => {
                  const groups = parseWinners(r)
                  return (
                    <div key={r.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/8 transition-colors">
                      {/* Event name */}
                      <div className="px-4 py-3 border-b border-white/10 bg-white/5">
                        <p className="font-semibold text-white text-sm">{r.events?.name}</p>
                      </div>

                      {/* Winners */}
                      <div className="p-3 space-y-2">
                        {groups.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2 text-center">No winners recorded</p>
                        ) : (
                          groups.map(g => (
                            <div key={g.rank} className={`border rounded-xl px-3 py-2.5 ${RANK_BG[g.rank] ?? 'bg-slate-800 border-slate-700'}`}>
                              <div className="flex items-start gap-2">
                                <span className="text-lg mt-0.5 leading-none">{MEDALS[g.rank] ?? `#${g.rank}`}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                    {RANK_LABELS[g.rank] ?? `#${g.rank}`}
                                    {g.entries.length > 1 && <span className="ml-1.5 text-amber-600">(Tied)</span>}
                                  </p>
                                  {g.entries.map((e, i) => (
                                    <p key={i} className="text-sm font-bold text-gray-800 leading-tight">
                                      {getSchoolName(e.slot)}
                                      {e.names ? <span className="font-normal text-gray-600"> · {e.names}</span> : null}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs text-slate-600">
        Reflections Cultural Event Management · Results update automatically
      </div>
    </div>
  )
}
