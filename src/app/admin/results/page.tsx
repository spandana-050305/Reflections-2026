'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Trophy, Lock, CheckCircle2, Clock, FileDown, User } from 'lucide-react'
import type { Category, Event } from '@/lib/types'
import PageSpinner from '@/components/layout/PageSpinner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface WinnerEntry { slot: number; entry: number; names: string }
interface WinnerGroup { rank: number; total: number; entries: WinnerEntry[] }

function parseWinners(result: any): WinnerGroup[] {
  if (!result?.winners_json) return []
  try { return JSON.parse(result.winners_json) } catch { return [] }
}

const RANK_LABELS: Record<number, string> = { 1: '🥇 1st Place', 2: '🥈 2nd Place', 3: '🥉 3rd Place' }
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
  const [manualMarks, setManualMarks] = useState<any[]>([])
  const [computing, setComputing] = useState<string | null>(null)
  const [selectedCat, setSelectedCat] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showMessage(text: string) {
    if (msgTimer.current) clearTimeout(msgTimer.current)
    setMessage(text)
    msgTimer.current = setTimeout(() => setMessage(''), 3000)
  }

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])
  const [rankPts, setRankPts] = useState<Record<number, number>>({ 1: 15, 2: 10, 3: 5 })

  async function load() {
    // Get current user for audit trail
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setCurrentUserEmail(user.email)

    const [
      { data: cats, error: catsErr },
      { data: evs,  error: evsErr  },
      { data: sc,   error: scErr   },
      { data: res,  error: resErr  },
      { data: stg,  error: stgErr  },
      { data: mk,   error: mkErr   },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*').order('name'),
      supabase.from('schools').select('slot_number, school_name').order('slot_number'),
      supabase.from('results').select('*'),
      supabase.from('settings').select('points_1st, points_2nd, points_3rd').maybeSingle(),
      supabase.from('marks').select('event_id, slot_number, entry_index, total'),
    ])
    const firstErr = catsErr ?? evsErr ?? scErr ?? resErr ?? stgErr ?? mkErr
    if (firstErr) { showMessage(`❌ Failed to load: ${firstErr.message}`); setLoading(false); return }
    setCategories(cats ?? [])
    setEvents(evs ?? [])
    setSchools(sc ?? [])
    setResults(res ?? [])
    setManualMarks(mk ?? [])
    if (stg) setRankPts({ 1: stg.points_1st ?? 15, 2: stg.points_2nd ?? 10, 3: stg.points_3rd ?? 5 })
    if (cats?.[0]) setSelectedCat(prev => prev || cats[0].id)
    setLoading(false)
  }

  async function computeWinners(eventId: string) {
    setComputing(eventId)
    const eventMarks = manualMarks.filter(m => m.event_id === eventId)
    if (eventMarks.length === 0) { showMessage('❌ No marks found for this event.'); setComputing(null); return }

    const sorted = [...eventMarks].sort((a, b) => Number(b.total) - Number(a.total))
    const groups: { rank: number; total: number; entries: { slot: number; entry: number; names: string }[] }[] = []
    let rank = 1, i = 0
    while (i < sorted.length && groups.length < 3) {
      const tied = sorted.filter(x => x.total === sorted[i].total)
      groups.push({ rank, total: Number(sorted[i].total), entries: tied.map(x => ({ slot: x.slot_number, entry: x.entry_index ?? 1, names: '' })) })
      rank += 1; i += tied.length
    }

    const { error } = await supabase.from('results').upsert({
      event_id: eventId,
      first_slot: groups[0]?.entries[0]?.slot ?? null,
      second_slot: groups[1]?.entries[0]?.slot ?? null,
      third_slot: groups[2]?.entries[0]?.slot ?? null,
      winners_json: JSON.stringify(groups),
      published: false,
      computed_by_email: currentUserEmail || null,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'event_id' })
    setComputing(null)
    if (error) { showMessage(`❌ ${error.message}`); return }
    showMessage('Winners computed ✓')
    await load()
  }

  useEffect(() => { load() }, [])

  function getSchoolName(slot: number | null): string {
    if (!slot) return '—'
    return schools.find(s => s.slot_number === slot)?.school_name ?? `Slot ${slot}`
  }

  async function togglePublish(eventId: string, currentlyPublished: boolean) {
    const { error } = await supabase.from('results').update({ published: !currentlyPublished }).eq('event_id', eventId)
    if (error) { showMessage(`❌ ${error.message}`); return }
    showMessage(currentlyPublished ? 'Result unpublished.' : 'Result published to schools!')
    await load()
  }

  function exportResultsPDF() {
    const eventsInCatForPDF = events.filter(e => e.category_id === selectedCat)
    const catName = categories.find(c => c.id === selectedCat)?.name ?? 'Results'
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Reflections Cultural Event', 14, 20)
    doc.setFontSize(13)
    doc.setTextColor(100)
    doc.text(`${catName} — Results`, 14, 28)
    doc.setFontSize(9)
    doc.text(`Exported on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 35)
    doc.setTextColor(0)

    let y = 44
    const MEDALS_TEXT: Record<number, string> = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' }

    eventsInCatForPDF.forEach(ev => {
      const result = results.find(r => r.event_id === ev.id)
      const winnerGroups = result ? parseWinners(result) : []
      if (winnerGroups.length === 0) return

      const rows = winnerGroups.flatMap(g =>
        g.entries.map(e => [
          MEDALS_TEXT[g.rank] ?? `#${g.rank}`,
          `Slot ${e.slot}`,
          getSchoolName(e.slot),
          e.names || '',
          g.total > 0 ? `${g.total}` : '',
        ])
      )

      autoTable(doc, {
        startY: y,
        head: [[{ content: ev.name + (result?.published ? ' ✓ Published' : ' (Draft)'), colSpan: 5, styles: { fillColor: [219, 39, 119], textColor: 255, fontStyle: 'bold', fontSize: 10 } }],
               ['Place', 'Slot', 'School', 'Names', 'Score']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [248, 113, 113], textColor: 255 },
        alternateRowStyles: { fillColor: [253, 242, 248] },
        didDrawPage: (data) => { y = data.cursor?.y ?? y },
      })
      y = (doc as any).lastAutoTable.finalY + 8
    })

    doc.save(`results-${catName.toLowerCase().replace(/\s+/g, '-')}.pdf`)
  }

  if (loading) return <PageSpinner />

  const eventsInCat = events.filter(e => e.category_id === selectedCat)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Trophy className="text-brand-600" size={24} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Results</h2>
            <p className="text-gray-500 text-sm">Winners auto-computed from marks · ties handled · names shown</p>
          </div>
        </div>
        <button onClick={exportResultsPDF} className="btn-secondary flex items-center gap-2 text-sm">
          <FileDown size={15} /> Export PDF
        </button>
      </div>

      {message && (
        <div className={`text-sm px-4 py-3 rounded-xl ${message.startsWith('❌') ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-green-50 border border-green-200 text-green-800'}`}>
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
                            <span className="text-xs text-brand-600 font-medium">+{rankPts[group.rank] ?? 0} pts each</span>
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
                        { label: '🥇 1st', slot: result.first_slot, pts: rankPts[1] },
                        { label: '🥈 2nd', slot: result.second_slot, pts: rankPts[2] },
                        { label: '🥉 3rd', slot: result.third_slot, pts: rankPts[3] },
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
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-400">No result yet.</p>
                      {manualMarks.some(m => m.event_id === ev.id) && (
                        <button
                          onClick={() => computeWinners(ev.id)}
                          disabled={computing === ev.id}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          {computing === ev.id ? 'Computing…' : 'Compute Winners'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Publish / Unpublish + Audit trail */}
                {result && (
                  <div className="shrink-0 mt-1 flex flex-col items-end gap-2">
                    <button
                      onClick={() => togglePublish(ev.id, result.published)}
                      className={result.published ? 'btn-danger' : 'btn-primary'}
                    >
                      {result.published ? 'Unpublish' : 'Publish Results'}
                    </button>
                    {result.computed_by_email && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <User size={10} />
                        <span>{result.computed_by_email}</span>
                        {result.computed_at && (
                          <span>· {new Date(result.computed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    )}
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
