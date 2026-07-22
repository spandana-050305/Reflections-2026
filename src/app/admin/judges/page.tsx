'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ClipboardCheck, RefreshCw, CheckCircle2, Clock } from 'lucide-react'
import { MAX_JUDGES } from '@/lib/types'
import PageSpinner from '@/components/layout/PageSpinner'

export default function JudgeTrackerPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [clearing, setClearing] = useState<string | null>(null)
  const [flashMsg, setFlashMsg] = useState('')
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  function flash(msg: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlashMsg(msg)
    flashTimer.current = setTimeout(() => setFlashMsg(''), 3500)
  }

  async function load() {
    const [
      { data: cats },
      { data: evs },
      { data: subs },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('id, name, category_id').order('name'),
      supabase.from('guest_marks').select('event_id, judge_number, judge_name').order('judge_number'),
    ])
    setCategories(cats ?? [])
    setEvents(evs ?? [])
    // Deduplicate: one row per (event_id, judge_number)
    const seen = new Set<string>()
    const deduped = (subs ?? []).filter(s => {
      const key = `${s.event_id}_${s.judge_number}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setSubmissions(deduped)
    setSelectedCat(prev => prev || cats?.[0]?.id || '')
    setLastRefreshed(new Date())
    setLoading(false)
  }

  useEffect(() => {
    load()
    refreshTimer.current = setInterval(load, 30000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [])

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  async function clearSubmission(eventId: string, judgeNumber: number, eventName: string) {
    if (!confirm(`Clear Judge ${judgeNumber}'s submission for "${eventName}"? They will be able to resubmit.`)) return
    const key = `${eventId}_${judgeNumber}`
    setClearing(key)
    const res = await fetch('/api/admin/clear-judge-submission', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, judgeNumber }),
    })
    const json = await res.json()
    setClearing(null)
    if (!res.ok) { flash(`❌ ${json.error ?? 'Failed'}`); return }
    flash(`Judge ${judgeNumber}'s submission for "${eventName}" cleared ✓`)
    await load()
  }

  if (loading) return <PageSpinner />

  const eventsInCat = events.filter(e => e.category_id === selectedCat)
  const judgeNums = Array.from({ length: MAX_JUDGES }, (_, i) => i + 1)

  // Total submitted / total slots across visible events
  const totalSlots = eventsInCat.length * MAX_JUDGES
  const totalSubmitted = eventsInCat.reduce((acc, ev) =>
    acc + judgeNums.filter(j => submissions.some(s => s.event_id === ev.id && s.judge_number === j)).length, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="text-brand-600" size={24} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Judge Tracker</h2>
            <p className="text-sm text-gray-500">
              See which judges submitted for which events
              {lastRefreshed && <span className="ml-2 text-xs text-gray-400">· {lastRefreshed.toLocaleTimeString()}</span>}
            </p>
          </div>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {flashMsg && (
        <div className={`text-sm px-4 py-3 rounded-xl ${flashMsg.startsWith('❌') ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-green-50 border border-green-200 text-green-800'}`}>
          {flashMsg}
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

      {/* Progress summary */}
      {eventsInCat.length > 0 && (
        <div className="card flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700">Category progress</span>
              <span className="text-sm font-bold text-brand-700">{totalSubmitted} / {totalSlots}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: totalSlots > 0 ? `${(totalSubmitted / totalSlots) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-gray-900">{totalSlots > 0 ? Math.round((totalSubmitted / totalSlots) * 100) : 0}%</p>
            <p className="text-xs text-gray-400">complete</p>
          </div>
        </div>
      )}

      {/* Grid */}
      {eventsInCat.length === 0 ? (
        <div className="card text-center text-gray-400 py-8">No events in this category.</div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-gray-500 font-medium w-48">Event</th>
                {judgeNums.map(j => (
                  <th key={j} className="px-3 py-3 text-center text-gray-500 font-medium w-20">
                    Judge {j}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-gray-500 font-medium">Done</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {eventsInCat.map(ev => {
                const submitted = judgeNums.filter(j => submissions.some(s => s.event_id === ev.id && s.judge_number === j))
                return (
                  <tr key={ev.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800 text-xs leading-snug">{ev.name}</td>
                    {judgeNums.map(j => {
                      const sub = submissions.find(s => s.event_id === ev.id && s.judge_number === j)
                      const key = `${ev.id}_${j}`
                      return (
                        <td key={j} className="px-3 py-3 text-center">
                          {sub ? (
                            <button
                              onClick={() => clearSubmission(ev.id, j, ev.name)}
                              disabled={clearing === key}
                              title={`${sub.judge_name || `Judge ${j}`} submitted · click to clear`}
                              className="inline-flex flex-col items-center gap-0.5 group"
                            >
                              <CheckCircle2 size={18} className="text-green-500 group-hover:text-red-400 transition-colors" />
                              <span className="text-[10px] text-gray-400 group-hover:text-red-400 transition-colors max-w-[56px] truncate">
                                {sub.judge_name || `J${j}`}
                              </span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center justify-center">
                              <Clock size={16} className="text-gray-200" />
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-semibold ${submitted.length === MAX_JUDGES ? 'text-green-600' : submitted.length > 0 ? 'text-amber-500' : 'text-gray-300'}`}>
                        {submitted.length}/{MAX_JUDGES}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Click a green ✓ to clear that judge's submission so they can resubmit. Auto-refreshes every 30s.
      </p>
    </div>
  )
}
