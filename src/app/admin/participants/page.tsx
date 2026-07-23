'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Pencil, Trash2, Check, X, FileDown, ClipboardList, Users, CheckCircle2, XCircle, Search } from 'lucide-react'
import PageSpinner from '@/components/layout/PageSpinner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Category, Event } from '@/lib/types'

type Tab = 'participants' | 'onspot' | 'search'

export default function AdminParticipantsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('participants')
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  // Edit state: participantId → editName
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // On-spot tab
  const [searchQuery, setSearchQuery] = useState('')
  const [allParticipants, setAllParticipants] = useState<any[]>([])
  const [searchLoaded, setSearchLoaded] = useState(false)
  const [onspots, setOnspots] = useState<any[]>([])
  const [onspotForm, setOnspotForm] = useState({ slot_number: '', participant_name: '', event_id: '', amount_paid: false })
  const [onspotSaving, setOnspotSaving] = useState(false)
  const [onspotFilter, setOnspotFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [eventSearch, setEventSearch] = useState('')
  const [showEventPicker, setShowEventPicker] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flash(msg: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setMessage(msg)
    flashTimer.current = setTimeout(() => setMessage(''), 3500)
  }
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  async function load() {
    const [
      { data: cats, error: catsErr },
      { data: evs,  error: evsErr  },
      { data: sc,   error: scErr   },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*').order('name'),
      supabase.from('schools').select('slot_number, school_name'),
    ])
    const firstErr = catsErr ?? evsErr ?? scErr
    if (firstErr) { flash(`❌ Failed to load data: ${firstErr.message}`); setLoading(false); return }
    setCategories(cats ?? [])
    setEvents(evs ?? [])
    setSchools(sc ?? [])
    if (!selectedCat && cats?.[0]) setSelectedCat(cats[0].id)
    setLoading(false)
  }

  async function loadParticipants(eventId: string) {
    if (!eventId) { setParticipants([]); return }
    const res = await fetch('/api/admin/load-admin-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: ['participants'] }),
    })
    if (!res.ok) { flash('❌ Failed to load participants'); return }
    const data = await res.json()
    setParticipants((data.participants ?? []).filter((p: any) => p.event_id === eventId))
  }

  async function loadOnspots() {
    const res = await fetch('/api/admin/load-admin-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: ['onspot_registrations'] }),
    })
    if (!res.ok) { flash('❌ Failed to load on-spot registrations'); return }
    const data = await res.json()
    setOnspots(data.onspot_registrations ?? [])
  }

  async function loadAllParticipants() {
    if (searchLoaded) return
    // Load all participants with event info via anon client (needs JOIN)
    const { data, error } = await supabase
      .from('participants')
      .select('*, events(name, categories(name))')
      .order('participant_name')
    if (error) { flash(`❌ ${error.message}`); return }
    setAllParticipants(data ?? [])
    setSearchLoaded(true)
  }

  useEffect(() => { load(); loadOnspots() }, [])
  useEffect(() => { if (selectedEvent) loadParticipants(selectedEvent) }, [selectedEvent])

  useEffect(() => {
    if (!showEventPicker) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('.event-picker-container')) setShowEventPicker(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEventPicker])

  if (loading) return <PageSpinner />

  const schoolMap: Record<number, string> = {}
  schools.forEach(s => { schoolMap[s.slot_number] = s.school_name })

  const selectedEventObj = events.find(e => e.id === selectedEvent)

  // ── On-spot ────────────────────────────────────────────────────────────────
  async function addOnspot() {
    if (onspotSaving) return
    const slotNum = parseInt(onspotForm.slot_number)
    const evId = onspotForm.event_id
    if (!slotNum || !evId || !onspotForm.participant_name.trim()) { flash('❌ Please fill all fields.'); return }
    const ev = events.find(e => e.id === evId)
    if (!ev) { flash('❌ Event not found.'); return }

    // Use service role to check entry count (bypasses RLS)
    const countRes = await fetch('/api/admin/load-guest-marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds: [evId] }),
    })
    if (!countRes.ok) { flash('❌ Could not verify entry count'); return }
    const countData = await countRes.json()
    const existing = (countData.participants ?? []).filter((p: any) => p.slot_number === slotNum)
    const distinctEntries = new Set(existing.map((r: any) => r.entry_index ?? 1)).size
    if (distinctEntries >= (ev.max_entries ?? 1)) {
      const schoolName = schools.find(s => s.slot_number === slotNum)?.school_name ?? `Slot ${slotNum}`
      flash(`❌ ${schoolName} has already reached the maximum ${ev.max_entries} entries for ${ev.name}.`)
      return
    }

    const nextEntry = distinctEntries + 1
    setOnspotSaving(true)
    const res = await fetch('/api/admin/onspot-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotNumber: slotNum, eventId: evId,
        participantName: onspotForm.participant_name.trim(),
        amountPaid: onspotForm.amount_paid,
        entryIndex: nextEntry,
      }),
    })
    if (!res.ok) { const j = await res.json(); flash(`❌ ${j.error ?? 'Registration failed'}`); setOnspotSaving(false); return }

    setOnspotForm({ slot_number: '', participant_name: '', event_id: '', amount_paid: false })
    setEventSearch('')
    await loadOnspots()
    if (selectedEvent === evId) loadParticipants(evId)
    flash('✓ On-spot registration saved.')
    setOnspotSaving(false)
  }

  async function toggleAmountPaid(id: string, current: boolean) {
    const res = await fetch('/api/admin/onspot-registration', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onspotId: id, amountPaid: !current }),
    })
    if (!res.ok) { flash('❌ Update failed'); return }
    setOnspots(prev => prev.map(o => o.id === id ? { ...o, amount_paid: !current } : o))
  }

  async function deleteOnspot(o: { id: string; slot_number: number; event_id: string; participant_name: string; entry_index?: number }) {
    const res = await fetch('/api/admin/onspot-registration', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onspotId: o.id, slotNumber: o.slot_number, eventId: o.event_id, participantName: o.participant_name, entryIndex: o.entry_index ?? 1 }),
    })
    if (!res.ok) { const j = await res.json(); flash(`❌ ${j.error ?? 'Delete failed'}`); return }
    setOnspots(prev => prev.filter(x => x.id !== o.id))
    if (selectedEvent === o.event_id) loadParticipants(selectedEvent)
  }

  const filteredOnspots = onspots.filter(o =>
    onspotFilter === 'all' ? true : onspotFilter === 'paid' ? o.amount_paid : !o.amount_paid
  )

  const filteredEventsByCategory = categories.map(cat => ({
    cat,
    evs: events.filter(e => e.category_id === cat.id &&
      (eventSearch === '' || e.name.toLowerCase().includes(eventSearch.toLowerCase())))
  })).filter(x => x.evs.length > 0)

  async function exportPDFForEvent(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    let pts = participants.filter((p: any) => p.event_id === eventId)
    if (pts.length === 0 && eventId !== selectedEvent) {
      const res = await fetch('/api/admin/load-guest-marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: [eventId] }),
      })
      if (!res.ok) { flash('❌ Export failed'); return }
      const data = await res.json()
      pts = data.participants ?? []
    }

    buildAndPrintPDF(ev, pts)
  }

  function buildAndPrintPDF(eventObj: any, pts: any[]) {
    const eventName = eventObj.name
    const isTeam = eventObj.is_team_event
    const multiEntry = eventObj.max_entries > 1

    const slots = [...new Set(pts.map((p: any) => p.slot_number))].sort((a: number, b: number) => a - b)

    // Build flat rows for the table
    const tableRows: string[][] = []
    slots.forEach(slot => {
      const schoolName = schoolMap[slot] ?? '—'
      const entries = [...new Set(pts.filter((p: any) => p.slot_number === slot).map((p: any) => p.entry_index))].sort((a: number, b: number) => a - b)
      entries.forEach(entry => {
        const members = pts
          .filter((p: any) => p.slot_number === slot && p.entry_index === entry)
          .sort((a: any, b: any) => a.member_index - b.member_index)
        members.forEach((m: any) => {
          const row: string[] = [`Slot ${slot}\n${schoolName}`]
          if (multiEntry) row.push(`Entry ${entry}`)
          row.push(isTeam ? `Member ${m.member_index}: ${m.participant_name}` : m.participant_name)
          tableRows.push(row)
        })
      })
    })

    const head = [['Slot / School', ...(multiEntry ? ['Entry'] : []), isTeam ? 'Members' : 'Participant']]

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(eventName, 14, 18)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`Participants — ${eventName}  ·  ${new Date().toLocaleDateString('en-IN')}`, 14, 25)
    doc.setTextColor(0)

    autoTable(doc, {
      startY: 32,
      head,
      body: tableRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [219, 39, 119], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 242, 248] },
    })

    doc.save(`participants-${eventName.toLowerCase().replace(/\s+/g, '-')}.pdf`)
  }

  async function exportExcelForEvent(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    let pts = participants.filter((p: any) => p.event_id === eventId)
    if (pts.length === 0 && eventId !== selectedEvent) {
      const res = await fetch('/api/admin/load-guest-marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: [eventId] }),
      })
      if (!res.ok) { flash('❌ Export failed'); return }
      const data = await res.json()
      pts = data.participants ?? []
    }

    buildAndDownloadExcel(ev, pts)
  }

  function buildAndDownloadExcel(eventObj: any, pts: any[]) {
    const eventName = eventObj.name
    const isTeam = eventObj.is_team_event

    const slots = [...new Set(pts.map((p: any) => p.slot_number))].sort((a: number, b: number) => a - b)

    const rows: any[] = []
    slots.forEach(slot => {
      const schoolName = schoolMap[slot] ?? '—'
      const entries = [...new Set(pts.filter((p: any) => p.slot_number === slot).map((p: any) => p.entry_index))].sort((a: number, b: number) => a - b)
      entries.forEach(entry => {
        const members = pts
          .filter((p: any) => p.slot_number === slot && p.entry_index === entry)
          .sort((a: any, b: any) => a.member_index - b.member_index)
        members.forEach((m: any) => {
          rows.push({
            Slot: slot,
            School: schoolName,
            Entry: entry,
            ...(isTeam ? { Member: m.member_index, Participant: m.participant_name } : { Participant: m.participant_name }),
          })
        })
      })
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 8 }, { wch: 10 }, { wch: 28 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Participants')
    XLSX.writeFile(wb, `participants-${eventName.toLowerCase().replace(/\s+/g, '-')}.xlsx`)
  }

  const filteredEvents = selectedCat ? events.filter(e => e.category_id === selectedCat) : events
  const slots = [...new Set(participants.map(p => p.slot_number))].sort((a, b) => a - b)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Participants</h2>
        {tab === 'participants' && selectedEvent && (
          <div className="flex gap-2">
            <button onClick={() => exportExcelForEvent(selectedEvent)} className="btn-secondary flex items-center gap-2 text-sm">
              <FileDown size={15} /> Export Excel
            </button>
            <button onClick={() => exportPDFForEvent(selectedEvent)} className="btn-secondary flex items-center gap-2 text-sm">
              <FileDown size={15} /> Export PDF
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${message.startsWith('❌') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
          {message}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-100 pb-1">
        <button onClick={() => setTab('participants')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium ${tab==='participants' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          <ClipboardList size={15} /> Registered Students
        </button>
        <button onClick={() => setTab('onspot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium ${tab==='onspot' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          <Users size={15} /> On-Spot
        </button>
        <button onClick={() => { setTab('search'); loadAllParticipants() }}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium ${tab==='search' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          <Search size={15} /> Search
        </button>
      </div>

      {tab === 'participants' && (
        <div className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => (
              <button key={c.id} onClick={() => { setSelectedCat(c.id); setSelectedEvent('') }}
                className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCat===c.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {filteredEvents.map(ev => (
              <div key={ev.id} className="flex items-center gap-1">
                <button onClick={() => setSelectedEvent(ev.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${selectedEvent===ev.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  {ev.name}
                </button>
                <button onClick={() => exportExcelForEvent(ev.id)} title="Export Excel"
                  className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50">
                  <FileDown size={14} />
                </button>
                <button onClick={() => exportPDFForEvent(ev.id)} title="Export PDF"
                  className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50">
                  <FileDown size={14} />
                </button>
              </div>
            ))}
          </div>

          {selectedEvent && slots.length === 0 && (
            <div className="card text-center text-gray-400 py-10">No participants for this event yet.</div>
          )}

          {slots.map(slot => {
            const slotParts = participants.filter(p => p.slot_number === slot)
            const entries = [...new Set(slotParts.map(p => p.entry_index ?? 1))].sort((a, b) => a - b)
            return (
              <div key={slot} className="card space-y-3">
                <h3 className="font-semibold text-gray-700">Slot {slot} — {schoolMap[slot] ?? '—'}</h3>
                {entries.map(entry => {
                  const members = slotParts.filter(p => (p.entry_index ?? 1) === entry).sort((a, b) => a.member_index - b.member_index)
                  return (
                    <div key={entry} className="border border-gray-100 rounded-xl overflow-hidden">
                      {(selectedEventObj?.max_entries ?? 1) > 1 && (
                        <div className="bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-500">Entry {entry}</div>
                      )}
                      {members.map(p => (
                        <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 first:border-t-0">
                          {editingId === p.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input value={editName} onChange={e => setEditName(e.target.value)} className="input flex-1" autoFocus
                                onKeyDown={async e => { if (e.key === 'Enter') { const trimmed = editName.trim(); if (!trimmed) { flash('❌ Name cannot be empty.'); return }; const r = await fetch('/api/admin/manage-participant', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: p.id, participantName: trimmed }) }); if (!r.ok) { const j = await r.json(); flash(`❌ ${j.error ?? 'Failed'}`); return } setEditingId(null); loadParticipants(selectedEvent) } }}
                              />
                              <button onClick={async () => { const trimmed = editName.trim(); if (!trimmed) { flash('❌ Name cannot be empty.'); return }; const r = await fetch('/api/admin/manage-participant', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: p.id, participantName: trimmed }) }); if (!r.ok) { const j = await r.json(); flash(`❌ ${j.error ?? 'Failed'}`); return } setEditingId(null); loadParticipants(selectedEvent) }} className="btn-primary px-2 py-1"><Check size={14} /></button>
                              <button onClick={() => setEditingId(null)} className="btn-secondary px-2 py-1"><X size={14} /></button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm text-gray-800">{selectedEventObj?.is_team_event ? `Member ${p.member_index}: ` : ''}{p.participant_name}</span>
                              <div className="flex gap-2">
                                <button onClick={() => { setEditingId(p.id); setEditName(p.participant_name) }} className="text-gray-400 hover:text-brand-600"><Pencil size={14} /></button>
                                <button onClick={async () => { const r = await fetch('/api/admin/manage-participant', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: p.id }) }); if (!r.ok) { const j = await r.json(); flash(`❌ ${j.error ?? 'Delete failed'}`); return } loadParticipants(selectedEvent) }} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-5">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input pl-9 w-full"
              placeholder="Search participant name…"
              autoFocus
            />
          </div>

          {!searchLoaded ? (
            <div className="card text-center text-gray-400 py-8">Loading all participants…</div>
          ) : searchQuery.trim().length < 2 ? (
            <div className="card text-center text-gray-400 py-8">Type at least 2 characters to search.</div>
          ) : (() => {
            const q = searchQuery.trim().toLowerCase()
            const found = allParticipants.filter(p =>
              p.participant_name.toLowerCase().includes(q)
            )
            if (found.length === 0) return (
              <div className="card text-center text-gray-400 py-8">No participants found for "{searchQuery}".</div>
            )
            return (
              <div className="card p-0 overflow-hidden divide-y divide-gray-50">
                {found.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div>
                      <p className="font-medium text-gray-800">{p.participant_name}</p>
                      <p className="text-xs text-gray-400">
                        {p.events?.categories?.name ?? '—'} · {p.events?.name ?? p.event_id}
                        {' '} · Slot {p.slot_number} — {schoolMap[p.slot_number] ?? '—'}
                        {' '} · Entry {p.entry_index}
                        {p.member_index > 1 && `, Member ${p.member_index}`}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50">{found.length} result{found.length !== 1 ? 's' : ''}</div>
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'onspot' && (
        <div className="space-y-5">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-800">New On-Spot Registration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">School (Slot)</label>
                <select value={onspotForm.slot_number} onChange={e => setOnspotForm(f => ({ ...f, slot_number: e.target.value }))} className="input">
                  <option value="">Select school…</option>
                  {schools.map(s => <option key={s.slot_number} value={s.slot_number}>Slot {s.slot_number} — {s.school_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Participant Name</label>
                <input value={onspotForm.participant_name} onChange={e => setOnspotForm(f => ({ ...f, participant_name: e.target.value }))} className="input" placeholder="Full name" />
              </div>
              <div className="sm:col-span-2 relative event-picker-container">
                <label className="block text-sm font-medium text-gray-600 mb-1">Event</label>
                <button type="button" onClick={() => setShowEventPicker(v => !v)} className="input text-left flex items-center justify-between">
                  <span className={onspotForm.event_id ? 'text-gray-800' : 'text-gray-400'}>
                    {onspotForm.event_id ? events.find(e => e.id === onspotForm.event_id)?.name : 'Select event…'}
                  </span>
                  <span className="text-gray-400 text-xs">▾</span>
                </button>
                {showEventPicker && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <input autoFocus value={eventSearch} onChange={e => setEventSearch(e.target.value)} className="input py-1.5" placeholder="Search events…" />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredEventsByCategory.map(({ cat, evs: catEvs }) => (
                        <div key={cat.id}>
                          <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100">{cat.name}</div>
                          {catEvs.map(ev => (
                            <button key={ev.id} type="button"
                              onClick={() => { setOnspotForm(f => ({ ...f, event_id: ev.id })); setShowEventPicker(false); setEventSearch('') }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50 hover:text-brand-700 ${onspotForm.event_id === ev.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'}`}>
                              {ev.name}
                            </button>
                          ))}
                        </div>
                      ))}
                      {filteredEventsByCategory.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">No events found.</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={onspotForm.amount_paid}
                    onChange={e => setOnspotForm(f => ({ ...f, amount_paid: e.target.checked }))}
                    className="w-4 h-4 rounded accent-brand-600" />
                  Amount Pending Collected
                </label>
                <button onClick={addOnspot} disabled={onspotSaving} className="btn-primary ml-auto">
                  {onspotSaving ? 'Registering…' : 'Register'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {(['all','paid','unpaid'] as const).map(f => (
              <button key={f} onClick={() => setOnspotFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${onspotFilter===f ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredOnspots.length === 0 && <div className="card text-center text-gray-400 py-8">No on-spot registrations yet.</div>}
            {filteredOnspots.map(o => (
              <div key={o.id} className="card flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-gray-800">{o.participant_name}</p>
                  <p className="text-xs text-gray-400">
                    Slot {o.slot_number} — {schoolMap[o.slot_number] ?? '—'} · {events.find(e => e.id === o.event_id)?.name ?? o.event_id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleAmountPaid(o.id, o.amount_paid)}
                    className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${o.amount_paid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {o.amount_paid ? <><CheckCircle2 size={12} />Paid</> : <><XCircle size={12} />Pending</>}
                  </button>
                  <button onClick={() => deleteOnspot(o)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
