'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import { Mail, Instagram } from 'lucide-react'

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

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

const MEDAL_ICON: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const RANK_LABEL: Record<number, string> = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' }
const RANK_STYLE: Record<number, string> = {
  1: 'bg-amber-50 border-amber-300 text-amber-900',
  2: 'bg-gray-50 border-gray-300 text-gray-700',
  3: 'bg-orange-50 border-orange-200 text-orange-900',
}
const RANK_BADGE: Record<number, string> = {
  1: 'bg-brand-600 text-white',
  2: 'bg-brand-400 text-white',
  3: 'bg-brand-300 text-brand-900',
}

export default function PublicResultsPage() {
  const supabase = createClient()
  const [results, setResults] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

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
    setLoading(false)
  }

  useEffect(() => {
    load()
    refreshTimer.current = setInterval(load, 30000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
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
    <div className="min-h-screen bg-brand-50 font-sans">

      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600" />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-brand-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl bg-brand-300/30 blur-md" />
              <div className="relative flex items-center justify-center h-11 w-11 rounded-xl bg-white shadow-sm ring-1 ring-brand-100">
                <Image src="/logo.png" alt="Rotaract Club MCE" width={34} height={34} className="object-contain" />
              </div>
            </div>
            <div className="leading-tight">
              <h1 className="font-bold text-brand-500 text-xl tracking-tight">Reflections'26</h1>
              <p className="text-brand-800 text-xs font-medium">Rotaract Club of MCE, Hassan</p>
            </div>
          </div>
          <div />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-10 space-y-12">

        {/* About section */}
        <section className="text-center space-y-4 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-brand-500">
            Reflections'26
          </h2>
          <p className="text-brand-800/80 text-base leading-relaxed">
            Reflections is the flagship inter-school cultural event organized by the Rotaract Club of MCE, Hassan.
            For over a decade, it has brought together talented students from schools across the region to showcase
            their creativity, knowledge, and skills through a wide range of competitions.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            {[['60+', 'Events'], ['60+', 'Schools'], ['1,000+', 'Participants']].map(([num, label]) => (
              <div key={label} className="bg-white border border-brand-200 rounded-2xl px-5 py-3 text-center shadow-card">
                <p className="text-2xl font-bold text-brand-600">{num}</p>
                <p className="text-xs text-brand-800/60 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Results section */}
        <section className="space-y-8">
          <div className="text-center space-y-1">
            <h3 className="text-2xl font-bold text-brand-900">Official Results</h3>
            <p className="text-brand-800/60 text-sm">The results published here are the official results of Reflections'26.</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-brand-800/50 text-sm">Loading results…</p>
            </div>
          ) : sortedCats.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-brand-100 shadow-card">
              <p className="text-brand-800/50">Results will appear here once they are published.</p>
            </div>
          ) : (
            sortedCats.map(catName => (
              <div key={catName} className="space-y-4">
                {/* Category heading */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-brand-200" />
                  <h4 className="text-sm font-bold uppercase tracking-widest text-brand-500 px-3">Category {catName.toUpperCase()}</h4>
                  <div className="h-px flex-1 bg-brand-200" />
                </div>

                <div className="space-y-4">
                  {byCat[catName].map((r: any) => {
                    const groups = parseWinners(r)
                    if (groups.length === 0) return null
                    return (
                      <div key={r.id} className="bg-white rounded-2xl border border-brand-100 shadow-card overflow-hidden">
                        {/* Event name */}
                        <div className="px-5 py-3 bg-gradient-to-r from-brand-50 to-white border-b border-brand-100">
                          <h5 className="font-bold text-brand-900 text-base">{r.events?.name}</h5>
                        </div>

                        {/* Results table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-brand-50">
                                <th className="text-left px-5 py-2.5 text-xs font-semibold text-brand-800/50 uppercase tracking-wide w-32">Position</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-brand-800/50 uppercase tracking-wide">Participant</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-brand-800/50 uppercase tracking-wide">School</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-brand-800/50 uppercase tracking-wide w-20">Slot</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-50">
                              {groups.map(g =>
                                g.entries.map((e, i) => (
                                  <tr key={`${g.rank}-${i}`} className={`${i === 0 && g.rank === 1 ? 'bg-amber-50/40' : ''}`}>
                                    {i === 0 && (
                                      <td className="px-5 py-3.5" rowSpan={g.entries.length}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xl">{MEDAL_ICON[g.rank] ?? `#${g.rank}`}</span>
                                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${RANK_BADGE[g.rank] ?? 'bg-gray-200 text-gray-700'}`}>
                                            {RANK_LABEL[g.rank] ?? `#${g.rank}`}
                                          </span>
                                        </div>
                                        {g.entries.length > 1 && (
                                          <span className="text-[10px] text-amber-600 font-medium mt-1 block">Tied</span>
                                        )}
                                      </td>
                                    )}
                                    <td className="px-4 py-3.5 font-medium text-brand-900">
                                      {e.names || '—'}
                                    </td>
                                    <td className="px-4 py-3.5 text-brand-800/70">
                                      {getSchoolName(e.slot)}
                                    </td>
                                    <td className="px-4 py-3.5 text-brand-500 font-semibold text-sm">
                                      {e.slot}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Contact section */}
        <section className="bg-white border border-brand-100 rounded-2xl shadow-card px-6 py-8 space-y-5">
          <h3 className="text-xl font-bold text-brand-900 text-center">Contact Information</h3>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="mailto:rotaractclub.mce91@gmail.com" className="flex items-center gap-2 text-brand-700 hover:text-brand-500 transition-colors font-medium">
              <Mail size={16} className="text-brand-500" />
              rotaractclub.mce91@gmail.com
            </a>
            <a href="https://instagram.com/rotaract_clubmce_" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-brand-700 hover:text-brand-500 transition-colors font-medium">
              <Instagram size={16} className="text-brand-500" />
              @rotaract_clubmce_
            </a>
          </div>
          <p className="text-center text-brand-800/50 text-xs">Rotaract Club of MCE, Hassan</p>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-brand-100 mt-10">
        <div className="max-w-5xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-800/50">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={20} height={20} className="object-contain opacity-60" />
            <span>© Reflections 2026 · Organized by Rotaract Club of MCE</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-brand-600 transition-colors">Privacy Policy</a>
            <span>·</span>
            <a href="#" className="hover:text-brand-600 transition-colors">Terms &amp; Conditions</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
