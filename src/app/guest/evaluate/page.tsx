'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, FileText, MapPin, Users, ClipboardList, Lock,
  CheckCircle2, FlaskConical, Send,
} from 'lucide-react'
import type { Category, Event } from '@/lib/types'
import { MAX_JUDGES, NUM_TRIALS, parseAssignedMembers } from '@/lib/types'

type Step = 'category' | 'event' | 'judge' | 'locked' | 'trial' | 'real' | 'done'

interface EntryRow {
  slot_number: number
  entry_index: number
  names: string
}

export default function GuestEvaluatePage() {
  const supabase = createClient()

  const [step, setStep] = useState<Step>('category')
  const [loading, setLoading] = useState(true)

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [schools, setSchools] = useState<any[]>([])

  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [event, setEvent] = useState<Event | null>(null)

  const [judgeName, setJudgeName] = useState('')
  const [judgeNumber, setJudgeNumber] = useState<number | ''>('')

  const [rows, setRows] = useState<EntryRow[]>([])
  const [trialNum, setTrialNum] = useState(1)
  const [scores, setScores] = useState<Record<string, number[]>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => { loadCategoriesAndEvents() }, [])

  async function loadCategoriesAndEvents() {
    setLoading(true)
    const [{ data: cats }, { data: evs }, { data: sch }] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*, categories(name)').order('name'),
      supabase.from('schools').select('slot_number, school_name').order('slot_number'),
    ])
    setCategories(cats ?? [])
    setEvents((evs as Event[]) ?? [])
    setSchools(sch ?? [])
    setLoading(false)
  }

  const eventsInCategory = useMemo(
    () => events.filter(e => e.category_id === categoryId),
    [events, categoryId]
  )

  function rowKey(slot: number, entry: number) { return `${slot}_${entry}` }

  function emptyScores(): number[] {
    return Array.from({ length: event?.criteria_count ?? 4 }, () => 0)
  }

  async function loadParticipantsForEvent(ev: Event) {
    const { data: participantData } = await supabase
      .from('participants')
      .select('slot_number, entry_index, member_index, participant_name')
      .eq('event_id', ev.id)
      .order('slot_number')
      .order('entry_index')
      .order('member_index')

    const grouped: Record<number, Record<number, string[]>> = {}
    ;(participantData ?? []).forEach((p: any) => {
      if (!grouped[p.slot_number]) grouped[p.slot_number] = {}
      if (!grouped[p.slot_number][p.entry_index]) grouped[p.slot_number][p.entry_index] = []
      grouped[p.slot_number][p.entry_index].push(p.participant_name)
    })

    const flat: EntryRow[] = []
    Object.keys(grouped).map(Number).sort((a, b) => a - b).forEach(slot => {
      Object.keys(grouped[slot]).map(Number).sort((a, b) => a - b).forEach(entryIdx => {
        flat.push({ slot_number: slot, entry_index: entryIdx, names: grouped[slot][entryIdx].join(', ') })
      })
    })
    setRows(flat)

    const init: Record<string, number[]> = {}
    flat.forEach(r => { init[rowKey(r.slot_number, r.entry_index)] = Array.from({ length: ev.criteria_count ?? 4 }, () => 0) })
    setScores(init)
  }

  function selectCategory(catId: string) {
    setCategoryId(catId)
    setStep('event')
  }

  async function selectEvent(ev: Event) {
    setEvent(ev)
    await loadParticipantsForEvent(ev)
    setStep('judge')
  }

  async function submitJudgeInfo() {
    if (!judgeName.trim()) { setSubmitError('Please enter your name.'); return }
    if (!judgeNumber) { setSubmitError('Please select your judge number.'); return }
    if (!event) return
    setSubmitError('')

    const { data: existing } = await supabase
      .from('guest_marks')
      .select('id')
      .eq('event_id', event.id)
      .eq('judge_number', judgeNumber)
      .limit(1)

    if ((existing ?? []).length > 0) {
      setStep('locked')
      return
    }

    setTrialNum(1)
    setScores(prev => {
      const reset: Record<string, number[]> = {}
      rows.forEach(r => { reset[rowKey(r.slot_number, r.entry_index)] = emptyScores() })
      return reset
    })
    setStep('trial')
  }

  function setScore(key: string, idx: number, value: number) {
    setScores(prev => {
      const next = [...(prev[key] ?? emptyScores())]
      next[idx] = value
      return { ...prev, [key]: next }
    })
  }

  function finishTrial() {
    if (trialNum < NUM_TRIALS) {
      setTrialNum(n => n + 1)
      const reset: Record<string, number[]> = {}
      rows.forEach(r => { reset[rowKey(r.slot_number, r.entry_index)] = emptyScores() })
      setScores(reset)
    } else {
      const reset: Record<string, number[]> = {}
      rows.forEach(r => { reset[rowKey(r.slot_number, r.entry_index)] = emptyScores() })
      setScores(reset)
      setStep('real')
    }
  }

  async function confirmSubmitMarks() {
    if (!event || !judgeNumber) return
    setSubmitting(true)
    setSubmitError('')

    for (const r of rows) {
      const key = rowKey(r.slot_number, r.entry_index)
      const criteriaScores = scores[key] ?? emptyScores()
      const judgeTotal = criteriaScores.reduce((a, b) => a + (Number(b) || 0), 0)

      const { error } = await supabase.from('guest_marks').upsert({
        event_id: event.id,
        judge_number: judgeNumber,
        judge_name: judgeName.trim(),
        slot_number: r.slot_number,
        entry_index: r.entry_index,
        criteria_scores: criteriaScores,
        judge_total: judgeTotal,
      }, { onConflict: ['event_id', 'judge_number', 'slot_number', 'entry_index'] })

      if (error) {
        setSubmitError('Error saving marks: ' + error.message)
        setSubmitting(false)
        return
      }
    }

    setShowConfirm(false)
    setSubmitting(false)
    setStep('done')
  }

  function backToStart() {
    setStep('category')
    setCategoryId(null)
    setEvent(null)
    setJudgeName('')
    setJudgeNumber('')
    setRows([])
    setScores({})
  }

  function schoolName(slot: number) {
    return schools.find(s => s.slot_number === slot)?.school_name
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto py-12 text-center text-gray-400">Loading…</div>
  }

  // ── Step: choose category ──
  if (step === 'category') {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Select a Category</h2>
          <p className="text-gray-500 text-sm mt-1">Choose the category you'll be judging.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => selectCategory(cat.id)}
              className="card text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors border border-gray-100"
            >
              <p className="font-semibold text-gray-800">{cat.name}</p>
              <p className="text-xs text-gray-400 mt-1">{events.filter(e => e.category_id === cat.id).length} events</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step: choose event within category ──
  if (step === 'event') {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <button onClick={() => setStep('category')} className="text-sm text-gray-500 hover:text-brand-600 flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to categories
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Select an Event</h2>
          <p className="text-gray-500 text-sm mt-1">Pick the event you'll be evaluating.</p>
        </div>
        <div className="space-y-3">
          {eventsInCategory.map(ev => (
            <button
              key={ev.id}
              onClick={() => selectEvent(ev)}
              className="card w-full text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors border border-gray-100"
            >
              <p className="font-semibold text-gray-800">{ev.name}</p>
              <div className="flex gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                {ev.venue && <span className="flex items-center gap-1"><MapPin size={11} /> {ev.venue}</span>}
                {ev.event_date && <span>{ev.event_date}{ev.event_time ? ` · ${ev.event_time}` : ''}</span>}
                {ev.rulebook_url && (
                  <span className="flex items-center gap-1 text-brand-600">
                    <FileText size={11} /> Rules available
                  </span>
                )}
              </div>
              {parseAssignedMembers(ev.assigned_members).length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <Users size={11} className="text-violet-400" /> Club members: {parseAssignedMembers(ev.assigned_members).join(', ')}
                </p>
              )}
            </button>
          ))}
          {eventsInCategory.length === 0 && (
            <div className="card text-center text-gray-400 py-10">No events in this category.</div>
          )}
        </div>
      </div>
    )
  }

  // ── Step: judge name + number ──
  if (step === 'judge' && event) {
    return (
      <div className="max-w-md mx-auto space-y-5">
        <button onClick={() => setStep('event')} className="text-sm text-gray-500 hover:text-brand-600 flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to events
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{event.name}</h2>
          <p className="text-gray-500 text-sm mt-1">Tell us who you are before evaluating.</p>
        </div>
        {event.venue && (
          <p className="text-sm text-gray-500 flex items-center gap-1.5"><MapPin size={13} /> {event.venue}</p>
        )}
        {parseAssignedMembers(event.assigned_members).length > 0 && (
          <p className="text-sm text-gray-500 flex items-center gap-1.5"><Users size={13} className="text-violet-400" /> Club members: {parseAssignedMembers(event.assigned_members).join(', ')}</p>
        )}

        <div className="card space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Your Name</label>
            <input className="input" value={judgeName} onChange={e => setJudgeName(e.target.value)} placeholder="e.g. Dr. Priya Menon" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">You are Judge #</label>
            <select className="input" value={judgeNumber} onChange={e => setJudgeNumber(+e.target.value)}>
              <option value="">Select judge number</option>
              {Array.from({ length: MAX_JUDGES }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>Judge {n}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Your event coordinator will tell you which judge number to pick.</p>
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <button onClick={submitJudgeInfo} className="btn-primary w-full">Submit</button>
        </div>
      </div>
    )
  }

  // ── Step: this judge number already submitted for this event ──
  if (step === 'locked' && event) {
    return (
      <div className="max-w-md mx-auto space-y-5 text-center py-10">
        <Lock size={36} className="mx-auto text-amber-500" />
        <h2 className="text-xl font-bold text-gray-900">Already Submitted</h2>
        <p className="text-gray-500 text-sm">
          Judge {judgeNumber} has already submitted marks for "{event.name}". Marks cannot be changed once submitted.
        </p>
        <button onClick={() => setStep('judge')} className="btn-secondary">Pick a different judge number</button>
      </div>
    )
  }

  // ── Step: trial / real marks entry (shared table UI) ──
  if ((step === 'trial' || step === 'real') && event) {
    const isTrial = step === 'trial'
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        {isTrial ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
            <FlaskConical size={15} /> Practice round {trialNum} of {NUM_TRIALS} — nothing here will be saved.
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
            <ClipboardList size={15} /> Real evaluation — Judge {judgeNumber} ({judgeName})
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold text-gray-900">{event.name}</h2>
          <p className="text-gray-500 text-sm mt-1">Enter a score for each criterion, for every participant.</p>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">Slot Number</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">Participant Name</th>
                  {Array.from({ length: event.criteria_count ?? 4 }, (_, i) => (
                    <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Criteria {i + 1}</th>
                  ))}
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const key = rowKey(r.slot_number, r.entry_index)
                  const rowScores = scores[key] ?? emptyScores()
                  const total = rowScores.reduce((a, b) => a + (Number(b) || 0), 0)
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border border-gray-100 font-medium text-gray-700">{r.slot_number}</td>
                      <td className="px-3 py-2 border border-gray-100">
                        <p className="text-gray-800">{r.names}</p>
                        <p className="text-xs text-gray-400">{schoolName(r.slot_number)}</p>
                      </td>
                      {rowScores.map((val, i) => (
                        <td key={i} className="px-2 py-1.5 border border-gray-100">
                          <input
                            type="number"
                            min={0}
                            value={val || ''}
                            placeholder="0"
                            onChange={e => setScore(key, i, e.target.value === '' ? 0 : Number(e.target.value))}
                            className="input w-16 text-center py-1 mx-auto block"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-gray-700">{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {rows.length === 0 && (
          <div className="card text-center text-gray-400 py-10">No participants registered for this event yet.</div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        {isTrial ? (
          <button onClick={finishTrial} className="btn-primary">
            {trialNum < NUM_TRIALS ? 'Next Practice Round' : 'Start Real Evaluation'}
          </button>
        ) : (
          <button onClick={() => setShowConfirm(true)} className="btn-primary flex items-center gap-2">
            <Send size={14} /> Submit Marks
          </button>
        )}

        {showConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
              <h3 className="font-semibold text-gray-900">Submit marks?</h3>
              <p className="text-sm text-gray-600">Are you sure you want to submit the marks? You cannot change the marks.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowConfirm(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={confirmSubmitMarks} disabled={submitting} className="btn-primary text-sm">
                  {submitting ? 'Submitting…' : 'Yes, Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Step: done ──
  if (step === 'done' && event) {
    return (
      <div className="max-w-md mx-auto space-y-5 text-center py-14">
        <CheckCircle2 size={40} className="mx-auto text-green-600" />
        <h2 className="text-2xl font-bold text-gray-900">Thank you for evaluating!</h2>
        <p className="text-gray-500 text-sm">
          Your marks for "{event.name}" as Judge {judgeNumber} have been submitted and locked.
        </p>
        <button onClick={backToStart} className="btn-secondary">Evaluate another event</button>
      </div>
    )
  }

  return null
}
