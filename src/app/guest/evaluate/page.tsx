'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, FileText, MapPin, Users, ClipboardList, Lock,
  CheckCircle2, FlaskConical, Plus, X, Search,
} from 'lucide-react'
import type { Category, Event } from '@/lib/types'
import { MAX_JUDGES, NUM_TRIALS, parseAssignedMembers } from '@/lib/types'
import MarkSelect from '@/components/MarkSelect'

type Step = 'category' | 'event' | 'judge' | 'locked' | 'trial' | 'ready' | 'real' | 'done'

interface EntryRow {
  slot_number: number
  entry_index: number
}

export default function GuestEvaluatePage() {
  const supabase = createClient()

  const [step, setStep] = useState<Step>('category')
  const [loading, setLoading] = useState(true)

  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])

  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [event, setEvent] = useState<Event | null>(null)

  const [judgeName, setJudgeName] = useState('')
  const [judgeNumber, setJudgeNumber] = useState<number | ''>('')
  // Who is assigned to (coordinating) this event — at least 2 fields shown.
  const [assignees, setAssignees] = useState<string[]>(['', ''])

  const [rows, setRows] = useState<EntryRow[]>([])
  const [trialNum, setTrialNum] = useState(1)
  const [trialSubmitted, setTrialSubmitted] = useState(false)
  const [scores, setScores] = useState<Record<string, number[]>>({})

  const [submittedRows, setSubmittedRows] = useState<Set<string>>(new Set())
  const [savingRow, setSavingRow] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [search, setSearch] = useState('')
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)

  useEffect(() => { loadCategoriesAndEvents() }, [])

  async function loadCategoriesAndEvents() {
    setLoading(true)
    const [{ data: cats, error: catsErr }, { data: evs, error: evsErr }] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*, categories(name)').order('name'),
    ])
    const firstErr = catsErr ?? evsErr
    if (firstErr) {
      setSubmitError(`Failed to load events: ${firstErr.message}`)
      setLoading(false)
      return
    }
    setCategories(cats ?? [])
    setEvents((evs as Event[]) ?? [])
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

  function criteriaLabel(i: number): string {
    const names = event?.criteria_names
    if (names && names[i] && names[i].trim()) return names[i].trim()
    return `Criteria ${i + 1}`
  }

  async function loadParticipantsForEvent(ev: Event) {
    const { data: participantData, error: partErr } = await supabase
      .from('participants')
      .select('slot_number, entry_index')
      .eq('event_id', ev.id)
      .order('slot_number')
      .order('entry_index')

    if (partErr) {
      setSubmitError(`Failed to load participants: ${partErr.message}`)
      return
    }

    const seen = new Set<string>()
    const flat: EntryRow[] = []
    ;(participantData ?? []).forEach((p: any) => {
      const k = `${p.slot_number}_${p.entry_index ?? 1}`
      if (!seen.has(k)) {
        seen.add(k)
        flat.push({ slot_number: p.slot_number, entry_index: p.entry_index ?? 1 })
      }
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
    const existing = parseAssignedMembers(ev.assigned_members)
    setAssignees(existing.length >= 2 ? existing : [...existing, ...Array(2 - existing.length).fill('')])
    await loadParticipantsForEvent(ev)
    setStep('judge')
  }

  async function submitJudgeInfo() {
    if (!judgeName.trim()) { setSubmitError('Please enter your name.'); return }
    if (!judgeNumber) { setSubmitError('Please select your judge number.'); return }
    if (!event) return
    setSubmitError('')

    // Persist the assignees entered for this event via server-side API route.
    const cleanAssignees = assignees.map(a => a.trim()).filter(Boolean)
    const assigneeRes = await fetch('/api/guest/update-assignees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, assignedMembers: cleanAssignees.length > 0 ? cleanAssignees : null }),
    })
    if (!assigneeRes.ok) {
      const j = await assigneeRes.json().catch(() => ({}))
      setSubmitError(`Failed to save assignees: ${j.error ?? 'Unknown error'}`)
      return
    }

    // Look for marks this judge has already submitted for this event.
    const { data: existing, error: fetchErr } = await supabase
      .from('guest_marks')
      .select('*')
      .eq('event_id', event.id)
      .eq('judge_number', judgeNumber)
    if (fetchErr) { setSubmitError(`Failed to check existing marks: ${fetchErr.message}`); return }

    const existingMarks = existing ?? []

    // Resume: load whatever was previously submitted so the judge can
    // continue where they left off (or see it's already finished).
    const reset: Record<string, number[]> = {}
    rows.forEach(r => { reset[rowKey(r.slot_number, r.entry_index)] = emptyScores() })
    const submitted = new Set<string>()
    existingMarks.forEach((m: any) => {
      const k = rowKey(m.slot_number, m.entry_index)
      submitted.add(k)
      reset[k] = [...(m.criteria_scores ?? emptyScores())]
    })
    setScores(reset)
    setSubmittedRows(submitted)

    if (existingMarks.length > 0) {
      // Already finished every row → fully locked for this judge.
      if (rows.length > 0 && submitted.size >= rows.length) {
        setStep('locked')
      } else {
        // Some rows done — resume the real evaluation, skip the trial.
        setSearch('')
        setStep('real')
      }
      return
    }

    // Brand-new judge — start with the practice trial.
    setTrialNum(1)
    setTrialSubmitted(false)
    setStep('trial')
  }

  function setScore(key: string, idx: number, value: number) {
    setScores(prev => {
      const next = [...(prev[key] ?? emptyScores())]
      next[idx] = value
      return { ...prev, [key]: next }
    })
  }

  function handleTrialNext() {
    // Each trial round is a single-student practice — no cycling through everyone.
    const reset: Record<string, number[]> = {}
    rows.forEach(r => { reset[rowKey(r.slot_number, r.entry_index)] = emptyScores() })
    setScores(reset)
    setTrialSubmitted(false)
    if (trialNum < NUM_TRIALS) {
      setTrialNum(n => n + 1)
    } else {
      setStep('ready')
    }
  }

  async function submitRow(r: EntryRow) {
    if (!event || !judgeNumber) return
    const key = rowKey(r.slot_number, r.entry_index)
    setSavingRow(key)
    setSubmitError('')

    const criteriaScores = scores[key] ?? emptyScores()
    const judgeTotal = criteriaScores.reduce((a, b) => a + (Number(b) || 0), 0)

    const res = await fetch('/api/guest/submit-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        judgeNumber,
        judgeName: judgeName.trim(),
        slotNumber: r.slot_number,
        entryIndex: r.entry_index,
        criteriaScores,
        judgeTotal,
      }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSubmitError('Error saving marks: ' + (j.error ?? 'Unknown error'))
      setSavingRow(null)
      return
    }

    const newSubmitted = new Set(submittedRows)
    newSubmitted.add(key)
    setSubmittedRows(newSubmitted)
    setSavingRow(null)
  }

  function backToStart() {
    setStep('category')
    setCategoryId(null)
    setEvent(null)
    setJudgeName('')
    setJudgeNumber('')
    setAssignees(['', ''])
    setRows([])
    setScores({})
    setTrialNum(1)
    setTrialSubmitted(false)
    setSubmittedRows(new Set())
    setSavingRow(null)
    setSubmitError('')
    setSearch('')
    setShowFinishConfirm(false)
  }

  // Keep the same event, but evaluate it as a different judge.
  function pickDifferentJudge() {
    setJudgeName('')
    setJudgeNumber('')
    setSubmittedRows(new Set())
    setSavingRow(null)
    setSubmitError('')
    setSearch('')
    setShowFinishConfirm(false)
    setTrialNum(1)
    setTrialSubmitted(false)
    const reset: Record<string, number[]> = {}
    rows.forEach(r => { reset[rowKey(r.slot_number, r.entry_index)] = emptyScores() })
    setScores(reset)
    setStep('judge')
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Assigned to this event</label>
              <button
                type="button"
                onClick={() => setAssignees(a => [...a, ''])}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {assignees.map((name, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="input flex-1"
                    placeholder={`Assignee ${i + 1} name`}
                    value={name}
                    onChange={e => setAssignees(a => a.map((v, j) => j === i ? e.target.value : v))}
                  />
                  {assignees.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setAssignees(a => a.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 shrink-0"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <button onClick={submitJudgeInfo} className="btn-primary w-full">Continue</button>
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
          Judge {judgeNumber} has already finished evaluating "{event.name}". Those marks can't be changed. Please continue as a different judge.
        </p>
        <button onClick={pickDifferentJudge} className="btn-primary">Pick a different judge</button>
        <div><button onClick={backToStart} className="btn-secondary">Evaluate another event</button></div>
      </div>
    )
  }

  // ── Step: trial — single-student practice (same row layout as real eval) ──
  if (step === 'trial' && event) {
    const totalCriteria = event.criteria_count ?? 4
    // Practice on just one sample student per round.
    const currentRow = rows[0]
    const key = currentRow ? rowKey(currentRow.slot_number, currentRow.entry_index) : 'trial'
    const rowScores = scores[key] ?? emptyScores()
    const total = rowScores.reduce((a, b) => a + (Number(b) || 0), 0)
    const isLastTrial = trialNum >= NUM_TRIALS

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <button onClick={() => setStep('judge')} className="text-sm text-gray-500 hover:text-brand-600 flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back
        </button>
        {/* Trial header */}
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <FlaskConical size={15} /> Trial Round {trialNum} of {NUM_TRIALS} — practice only, nothing here is saved
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">{event.name}</h2>
          <p className="text-gray-500 text-sm mt-1">Practice entering scores for one sample student — just like the real round.</p>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">Slot</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">Entry</th>
                  {Array.from({ length: totalCriteria }, (_, i) => (
                    <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">{criteriaLabel(i)}</th>
                  ))}
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Total</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className={trialSubmitted ? 'bg-green-50/40' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2 border border-gray-100 font-medium text-gray-700">{currentRow?.slot_number ?? '—'}</td>
                  <td className="px-3 py-2 border border-gray-100">
                    <p className="text-gray-800">Entry {currentRow ? currentRow.entry_index : 1}</p>
                  </td>
                  {rowScores.map((val, i) => (
                    <td key={i} className="px-2 py-1.5 border border-gray-100">
                      <MarkSelect value={val} onChange={n => setScore(key, i, n)} disabled={trialSubmitted} />
                    </td>
                  ))}
                  <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-gray-700">
                    {trialSubmitted ? total : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 border border-gray-100 text-center">
                    {trialSubmitted ? (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1 justify-center">
                        <CheckCircle2 size={12} /> Submitted
                      </span>
                    ) : (
                      <button onClick={() => setTrialSubmitted(true)} className="btn-primary text-xs px-3 py-1">
                        Submit
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <button onClick={handleTrialNext} disabled={!trialSubmitted} className="btn-primary w-full sm:w-auto">
          {isLastTrial ? 'Done — Ready to Evaluate' : 'Next Trial Round'}
        </button>
      </div>
    )
  }

  // ── Step: all trials done, ready to start real eval ──
  if (step === 'ready' && event) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-10">
        <CheckCircle2 size={48} className="mx-auto text-green-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All good!</h2>
          <p className="text-gray-500 text-sm mt-2">Practice complete. You're ready to evaluate for real.</p>
        </div>
        <div className="card text-left">
          <p className="text-base font-semibold text-gray-800">{event.name}</p>
          {event.venue && <p className="text-sm text-gray-500 mt-1 flex items-center gap-1"><MapPin size={13} /> {event.venue}</p>}
          {event.rules && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rules</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.rules}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => { setSubmittedRows(new Set()); setStep('real') }}
          className="btn-primary w-full text-base py-3"
        >
          Start Evaluation
        </button>
      </div>
    )
  }

  // ── Step: real marks entry ──
  if (step === 'real' && event) {
    const totalCriteria = event.criteria_count ?? 4
    const q = search.trim().toLowerCase()
    const visibleRows = q
      ? rows.filter(r => String(r.slot_number).includes(q))
      : rows

    const allDone = rows.length > 0 && submittedRows.size >= rows.length

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <button onClick={() => setStep('judge')} className="text-sm text-gray-500 hover:text-brand-600 flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back / pause — submitted rows are saved
        </button>
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <ClipboardList size={15} /> Real evaluation — Judge {judgeNumber} ({judgeName})
        </div>

        {event.rules && (
          <div className="card">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rules</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.rules}</p>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold text-gray-900">{event.name}</h2>
          <p className="text-gray-500 text-sm mt-1">Enter scores for each criterion, then submit each row.</p>
        </div>

        {/* Search — find a slot fast on mobile instead of scrolling */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search slot number…"
            className="input pl-9"
            inputMode="search"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">Slot</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100">Entry</th>
                  {Array.from({ length: totalCriteria }, (_, i) => (
                    <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">{criteriaLabel(i)}</th>
                  ))}
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Total</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 border border-gray-100 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r => {
                  const key = rowKey(r.slot_number, r.entry_index)
                  const rowScores = scores[key] ?? emptyScores()
                  const total = rowScores.reduce((a, b) => a + (Number(b) || 0), 0)
                  const isSubmitted = submittedRows.has(key)
                  const isSaving = savingRow === key
                  return (
                    <tr key={key} className={isSubmitted ? 'bg-green-50/40' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-2 border border-gray-100 font-medium text-gray-700">{r.slot_number}</td>
                      <td className="px-3 py-2 border border-gray-100">
                        <p className="text-gray-800">Slot {r.slot_number} — Entry {r.entry_index}</p>
                      </td>
                      {rowScores.map((val, i) => (
                        <td key={i} className="px-2 py-1.5 border border-gray-100">
                          <MarkSelect value={val} onChange={n => setScore(key, i, n)} disabled={isSubmitted} />
                        </td>
                      ))}
                      <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-gray-700">
                        {isSubmitted ? total : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border border-gray-100 text-center">
                        {isSubmitted ? (
                          <span className="text-xs text-green-600 font-medium flex items-center gap-1 justify-center">
                            <CheckCircle2 size={12} /> Submitted
                          </span>
                        ) : (
                          <button
                            onClick={() => submitRow(r)}
                            disabled={!!isSaving}
                            className="btn-primary text-xs px-3 py-1"
                          >
                            {isSaving ? 'Saving…' : 'Submit'}
                          </button>
                        )}
                      </td>
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
        {rows.length > 0 && visibleRows.length === 0 && (
          <div className="card text-center text-gray-400 py-8 text-sm">No slots match "{search}".</div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        <p className="text-xs text-gray-400">{submittedRows.size} of {rows.length} rows submitted. Marks are locked per row after submission.</p>

        {rows.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button onClick={() => setShowFinishConfirm(true)} className="btn-primary flex items-center gap-2">
              <CheckCircle2 size={15} /> Finish Evaluating Event
            </button>
            {!allDone && (
              <p className="text-xs text-amber-600 sm:self-center">
                {rows.length - submittedRows.size} row(s) not yet submitted — you can finish now and resume later as this judge.
              </p>
            )}
          </div>
        )}

        {showFinishConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
              <h3 className="font-semibold text-gray-900">Finish evaluating this event?</h3>
              <p className="text-sm text-gray-600">
                {allDone
                  ? 'All rows are submitted. You\'ll be asked to continue as a different judge.'
                  : `${submittedRows.size} of ${rows.length} rows are submitted. You can come back to this judge later to finish the rest.`}
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowFinishConfirm(false)} className="btn-secondary text-sm">Keep evaluating</button>
                <button onClick={() => { setShowFinishConfirm(false); setStep('done') }} className="btn-primary text-sm">Finish</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Step: done ──
  if (step === 'done' && event) {
    const allDone = rows.length > 0 && submittedRows.size >= rows.length
    return (
      <div className="max-w-md mx-auto space-y-5 text-center py-14">
        <CheckCircle2 size={40} className="mx-auto text-green-600" />
        <h2 className="text-2xl font-bold text-gray-900">{allDone ? 'Thank you for evaluating!' : 'Progress saved'}</h2>
        <p className="text-gray-500 text-sm">
          {allDone
            ? `All marks for "${event.name}" as Judge ${judgeNumber} have been submitted and locked.`
            : `${submittedRows.size} of ${rows.length} rows saved for "${event.name}" as Judge ${judgeNumber}. Re-select Judge ${judgeNumber} any time to finish the rest.`}
        </p>
        <p className="text-sm font-medium text-gray-700">Please continue as a different judge.</p>
        <button onClick={pickDifferentJudge} className="btn-primary">Select a different judge</button>
        <div><button onClick={backToStart} className="btn-secondary">Evaluate another event</button></div>
      </div>
    )
  }

  return null
}
