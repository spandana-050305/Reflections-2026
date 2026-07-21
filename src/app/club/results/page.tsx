import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Trophy } from 'lucide-react'

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const POSITIONS: Record<number, string> = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' }
const RANK_BG: Record<number, string> = { 1: 'bg-amber-50', 2: 'bg-gray-50', 3: 'bg-orange-50/60' }

function parseWinners(r: any): WinnerGroup[] {
  if (r?.winners_json) {
    try { return JSON.parse(r.winners_json) } catch { /* ignore */ }
  }
  // Fallback: old format
  const groups: WinnerGroup[] = []
  const slots = [r?.first_slot, r?.second_slot, r?.third_slot]
  slots.forEach((slot, i) => {
    if (slot != null) {
      groups.push({ rank: i + 1, total: 0, entries: [{ slot, entry: 1, names: '' }] })
    }
  })
  return groups
}

export default async function ClubResultsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: results } = await supabase
    .from('results')
    .select('*, events(*, categories(name, display_order))')
    .eq('published', true)
    .order('created_at', { ascending: false })

  const catOrder: Record<string, number> = {}
  const byCat: Record<string, any[]> = {}
  ;(results ?? []).forEach((r: any) => {
    const cat = r.events?.categories?.name ?? 'Other'
    if (!byCat[cat]) {
      byCat[cat] = []
      catOrder[cat] = r.events?.categories?.display_order ?? 999
    }
    byCat[cat].push(r)
  })
  const sortedCats = Object.keys(byCat).sort((a, b) => (catOrder[a] ?? 999) - (catOrder[b] ?? 999))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="text-brand-600" size={24} />
        <h2 className="text-2xl font-bold text-gray-900">Results</h2>
      </div>

      {Object.keys(byCat).length === 0 && (
        <div className="card text-center text-gray-400 py-12">
          Results will appear here once they are published.
        </div>
      )}

      {sortedCats.map(catName => { const catResults = byCat[catName]; return (
        <div key={catName} className="card">
          <h3 className="text-lg font-semibold text-brand-700 mb-4 pb-2 border-b border-gray-100">{catName}</h3>
          <div className="space-y-4">
            {catResults.map((r: any) => {
              const groups = parseWinners(r)
              return (
                <div key={r.event_id ?? r.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5">
                    <p className="font-semibold text-gray-800 text-sm">{r.events?.name}</p>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {groups.map(g => (
                      <div key={g.rank} className={`px-4 py-3 ${RANK_BG[g.rank] ?? ''}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl w-8 mt-0.5">{MEDALS[g.rank] ?? `#${g.rank}`}</span>
                          <div className="flex-1">
                            <p className="text-xs text-gray-400 font-medium mb-0.5">{POSITIONS[g.rank] ?? `#${g.rank}`}</p>
                            {g.entries.map((e, i) => {
                              const multi = g.entries.filter(x => x.slot === e.slot).length > 1 ||
                                groups.some(grp => grp.entries.some(x => x.slot === e.slot && x.entry !== e.entry))
                              const label = multi ? `Slot ${e.slot} (Entry ${e.entry})` : `Slot ${e.slot}`
                              return (
                                <p key={i} className="text-sm font-semibold text-gray-800">
                                  {label}{e.names ? ` — ${e.names}` : ''}
                                </p>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )})}
    </div>
  )
}
