'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Trophy, Lock, CheckCircle2, Clock } from 'lucide-react'
import type { Category, Event } from '@/lib/types'

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

function parseWinners(result: any): WinnerGroup[] {
  if (!result?.winners_json) return []
  try { return JSON.parse(result.winners_json) } catch { return [] }
}

const RANK_LABELS: Record<number, string> = { 1: '🥇 1st Place', 2: '🥈 2nd Place', 3: '🥉 3rd Place' }
const RANK_PTS: Record<number, number> = { 1: 15, 2: 10, 3: 5 }
const RANK_BG: Record<number, string> = {
  1: 'bg-amber-50 border-amber-200',
  2: 'bg-gray-50 border-gray-200',
  3: 'bg-orange-50 border-orange-200',
}

export default function AdminResultsPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const [{ data: cats }, { data: evs }, { data: sc }, { data: res }] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*').order('name'),
      supabase.from('schools').select('slot_number, school_name').order('slot_number'),
      supabase.from('results').select('*'),
    ])
    setCategories(cats ?? [])
    setEvents(evs ?? [])
    setSchools(sc ?? [])
    setResults(res ?? [])
    if (cats?.[0]) setSelectedCat(prev => prev || cats[0].id)
  }

  useEffect(() => { load() }, [])

  function getSchoolName(slot: number | null): string {
    if (!slot) return '—'
    return schools.find(s => s.slot_number === slot)?.school_name ?? `Slot ${slot}`
  }

  async function togglePublish(eventId: string, currentlyPublished: boolean) {
    await supabase.from('results').update({ published: !currentlyPublished }).eq('event_id', eventId)
    setMessage(currentlyPublished ? 'Result unpublished.' : 'Result published to schools!')
    await load()
    setTimeout(() => setMessage(''), 3000)
  }

  const eventsInCat = events.filter(e => e.category_id === selectedCat)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Trophy className="text-brand-600" size={24} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Results</h2>
          <p className="text-gray-500 text-sm">Winners auto-computed from marks · ties handled · names shown</p>
        </div>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-xl">
          {message}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${cat.id === selectedCat ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Events */}
      <div className="space-y-3">
        {eventsInCat.length === 0 && (
          <div className="card text-center text-gray-400 py-8">No events in this category.</div>
        )}
        {eventsInCat.map(ev => {
          const result = results.find(r => r.event_id === ev.id)
          const winnerGroups = parseWinners(result)

          return (
            <div key={ev.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Title + status badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-gray-800">{ev.name}</h3>
                    {result ? (
                      result.published ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 size={11} /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          <Lock size={11} /> Draft
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        <Clock size={11} /> Awaiting marks
                      </span>
                    )}
                  </div>

                  {/* Winners from winners_json */}
                  {winnerGroups.length > 0 ? (
                    <div className="space-y-2">
                      {winnerGroups.map(group => (
                        <div key={group.rank} className={`border rounded-lg px-3 py-2.5 ${RANK_BG[group.rank] ?? 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-700">{RANK_LABELS[group.rank] ?? `#${group.rank}`}</span>
                            <span className="text-xs text-brand-600 font-medium">+{RANK_PTS[group.rank] ?? 0} pts each</span>
                            {group.entries.length > 1 && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                Tied ({group.entries.length} entries)
                              </span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">Score: {group.total}</span>
                          </div>

                          <div className="space-y-1">
                            {group.entries.map((entry, i) => {
                              const hasMultiEntry = group.entries.some(e => e.slot === entry.slot && e.entry !== entry.entry)
                              const label = hasMultiEntry
                                ? `Slot ${entry.slot} Entry ${entry.entry}`
                                : `Slot ${entry.slot}`
                              return (
                                <div key={i} className="flex items-baseline gap-2">
                                  <span className="font-medium text-gray-800 text-sm">{label}</span>
                                  <span className="text-xs text-gray-500">({getSchoolName(entry.slot)})</span>
                                  {entry.names && (
                                    <span className="text-xs text-brand-700 font-medium">· {entry.names}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : result ? (
                    // Old-format result (no winners_json)
                    <div className="flex gap-3 flex-wrap">
                      {[
                        { label: '🥇 1st', slot: result.first_slot, pts: 15 },
                        { label: '🥈 2nd', slot: result.second_slot, pts: 10 },
                        { label: '🥉 3rd', slot: result.third_slot, pts: 5 },
                      ].map(({ label, slot, pts }) => (
                        <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                          <span className="text-gray-500 text-xs">{label}</span>
                          <p className="font-semibold text-gray-800 mt-0.5">
                            {slot ? `Slot ${slot} — ${getSchoolName(slot)}` : '—'}
                          </p>
                          {slot && <p className="text-xs text-brand-600 font-medium">+{pts} pts</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Finalize marks in the Marks section to compute winners.
                    </p>
                  )}
                </div>

                {/* Publish / Unpublish */}
                {result && (
                  <div className="shrink-0 mt-4 flex gap-2">
                    <button
                      onClick={() => togglePublish(ev.id, result.published)}
                      className={result.published ? 'btn-danger' : 'btn-primary'}
                    >
                      {result.published ? 'Unpublish' : 'Publish Results'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
