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
  // Fallback for old-format results
  const groups: WinnerGroup[] = []
  const slots = [r?.first_slot, r?.second_slot, r?.third_slot]
  slots.forEach((slot, i) => {
    if (slot != null) {
      groups.push({ rank: i + 1, total: 0, entries: [{ slot, entry: 1, names: '' }] })
    }
  })
  return groups
}

export default async function SchoolResultsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/')

  const slotNumber = (user.user_metadata?.slot_number as number | undefined) ?? 0

  const { data: results } = await supabase
    .from('results')
    .select('*, events(*, categories(name, display_order))')
    .eq('published', true)
    .order('created_at', { ascending: false })

  // Group published results by category, preserving display_order
  const catOrder: Record<string, number> = {}
  const byCat: Record<string, any[]> = {}
  ;(results ?? []).forEach((r: any) => {
    const catName = r.events?.categories?.name ?? 'Other'
    if (!byCat[catName]) {
      byCat[catName] = []
      catOrder[catName] = r.events?.categories?.display_order ?? 999
    }
    byCat[catName].push(r)
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
          <h3 className="text-lg font-semibold text-brand-700 mb-4 pb-2 border-b border-gray-100">
            {catName}
          </h3>
          <div className="space-y-4">
            {catResults.map((r: any) => {
              const groups = parseWinners(r)
              const mySlotInResults = groups.some(g => g.entries.some(e => e.slot === slotNumber))

              return (
                <div key={r.id} className={`border rounded-xl overflow-hidden ${mySlotInResults ? 'border-brand-300' : 'border-gray-100'}`}>
                  <div className={`px-4 py-2.5 ${mySlotInResults ? 'bg-brand-50' : 'bg-gray-50'}`}>
                    <p className="font-semibold text-gray-800 text-sm">{r.events?.name}</p>
                    {mySlotInResults && (
                      <p className="text-xs text-brand-600 font-medium mt-0.5">🎉 Your school placed in this event!</p>
                    )}
                  </div>

                  <div className="divide-y divide-gray-50">
                    {groups.map(g => {
                      const myEntry = g.entries.find(e => e.slot === slotNumber)
                      return (
                        <div key={g.rank} className={`px-4 py-3 ${myEntry ? 'bg-brand-50/60' : (RANK_BG[g.rank] ?? '')}`}>
                          <div className="flex items-start gap-3">
                            <span className="text-2xl w-8 mt-0.5">{MEDALS[g.rank] ?? `#${g.rank}`}</span>
                            <div className="flex-1">
                              <p className="text-xs text-gray-400 font-medium">{POSITIONS[g.rank] ?? `#${g.rank}`}</p>

                              {/* Each tied/multi entry */}
                              {g.entries.map((e, i) => {
                                const multi = g.entries.filter(x => x.slot === e.slot).length > 1 ||
                                  groups.some(grp => grp.entries.some(x => x.slot === e.slot && x.entry !== e.entry))
                                const isMe = e.slot === slotNumber
                                const label = multi ? `Slot ${e.slot} (Entry ${e.entry})` : `Slot ${e.slot}`
                                return (
                                  <p key={i} className={`text-sm font-semibold ${isMe ? 'text-brand-700' : 'text-gray-800'}`}>
                                    {label}{e.names ? ` — ${e.names}` : ''}{isMe ? ' ✦' : ''}
                                  </p>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
