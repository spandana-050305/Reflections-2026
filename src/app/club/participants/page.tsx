'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Pencil, Trash2, Check, X, PlusCircle, ClipboardList, Users, CheckCircle2, XCircle, FileDown } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Category, Event } from '@/lib/types'

type Tab = 'participants' | 'onspot'

export default function ClubParticipantsPage() {
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('participants')

  // ── Shared ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  const [message, setMessage] = useState('')

  // ── Participants tab ─────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  // ── On-spot tab ──────────────────────────────────────────────────────────
  const [onspots, setOnspots] = useState<any[]>([])
  const [onspotForm, setOnspotForm] = useState({
    slot_number: '',
    participant_name: '',
    event_id: '',
    amount_paid: false,
  })
  const [onspotSaving, setOnspotSaving] = useState(false)
  const [editOnspotId, setEditOnspotId] = useState<string | null>(null)
  const [onspotFilter, setOnspotFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [eventSearch, setEventSearch] = useState('')
  const [showEventPicker, setShowEventPicker] = useState(false)

  function flash(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3500)
  }

  // ── Load base data ────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadBase() {
      const [{ data: cats }, { data: evs }, { data: sc }] = await Promise.all([
        supabase.from('categories').select('*').order('display_order'),
        supabase.from('events').select('*').order('name'),
        supabase.from('schools').select('slot_number, school_name').order('slot_number'),
      ])
      setCategories(cats ?? [])
      setEvents(evs ?? [])
      setSchools(sc ?? [])
      if (cats?.[0]) setSelectedCat(cats[0].id)
    }
    loadBase()
    loadOnspots()
  }, [])

  useEffect(() => {
    if (selectedEvent) loadParticipants(selectedEvent)
    else setParticipants([])
  }, [selectedEvent])

  useEffect(() => {
    if (!showEventPicker) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('.event-picker-container')) setShowEventPicker(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEventPicker])

  // ── Participants ─────────────────────────────────────────────────────────
  async function loadParticipants(eventId: string) {
    const { data } = await supabase
      .from('participants').select('*')
      .eq('event_id', eventId)
      .order('slot_number').order('entry_index').order('member_index')
    setParticipants(data ?? [])
  }

  async function exportPDFForEvent(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    let pts = participants
    if (eventId !== selectedEvent) {
      const { data } = await supabase
        .from('participants').select('*')
        .eq('event_id', eventId)
        .order('slot_number').order('entry_index').order('member_index')
      pts = data ?? []
    }
    buildAndPrintPDF(ev, pts)
  }

  function buildAndPrintPDF(eventObj: any, pts: any[]) {
    const eventName = eventObj.name
    const isTeam = eventObj.is_team_event
    const multiEntry = eventObj.max_entries > 1
    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    const slots = [...new Set(pts.map((p: any) => p.slot_number))].sort((a: number, b: number) => a - b)
    const tableRows: string[][] = []
    slots.forEach(slot => {
      const schoolName = schoolMap[slot] ?? '—'
      const entries = [...new Set(pts.filter((p: any) => p.slot_number === slot).map((p: any) => p.entry_index))].sort()
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
    doc.text(`Participants — Generated ${date}`, 14, 25)
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 32, head, body: tableRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [219, 39, 119], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 242, 248] },
    })
    doc.save(`participants-${eventName.toLowerCase().replace(/\s+/g, '-')}.pdf`)
  }

  async function exportExcelForEvent(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    let pts = participants
    if (eventId !== selectedEvent) {
      const { data } = await supabase
        .from('participants').select('*')
        .eq('event_id', eventId)
        .order('slot_number').order('entry_index').order('member_index')
      pts = data ?? []
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
      const entries = [...new Set(pts.filter((p: any) => p.slot_number === slot).map((p: any) => p.entry_index))].sort()
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

  async function loadOnspots() {
    const { data } = await supabase.from('onspot_registrations').select('*').order('created_at', { ascending: false })
    setOnspots(data ?? [])
  }

  async function addOnspot() {
    const slotNum = parseInt(onspotForm.slot_number)
    const evId = onspotForm.event_id
    if (!slotNum || !evId || !onspotForm.participant_name.trim()) { flash('❌ Please fill all fields.'); return }
    const ev = events.find(e => e.id === evId)
    if (!ev) { flash('❌ Event not found.'); return }

    const { data: existing } = await supabase.from('participants').select('entry_index').eq('slot_number', slotNum).eq('event_id', evId)
    const distinctEntries = new Set((existing ?? []).map((r: any) => r.entry_index)).size
    if (distinctEntries >= (ev.max_entries ?? 1)) {
      const schoolName = schools.find(s => s.slot_number === slotNum)?.school_name ?? `Slot ${slotNum}`
      flash(`❌ ${schoolName} has already reached the maximum ${ev.max_entries} entries for ${ev.name}.`)
      return
    }

    const nextEntry = distinctEntries + 1
    setOnspotSaving(true)
    await supabase.from('onspot_registrations').insert({
      slot_number: slotNum, event_id: evId,
      participant_name: onspotForm.participant_name.trim(),
      amount_paid: onspotForm.amount_paid,
      created_at: new Date().toISOString(),
    })
    await supabase.from('participants').insert({
      slot_number: slotNum, event_id: evId,
      participant_name: onspotForm.participant_name.trim(),
      entry_index: nextEntry, member_index: 1,
      created_at: new Date().toISOString(),
    })
    setOnspotForm({ slot_number: '', participant_name: '', event_id: '', amount_paid: false })
    setEventSearch('')
    await loadOnspots()
    if (selectedEvent === evId) loadParticipants(evId)
    flash('✓ On-spot registration saved.')
    setOnspotSaving(false)
  }

  async function toggleAmountPaid(id: string, current: boolean) {
    await supabase.from('onspot_registrations').update({ amount_paid: !current }).eq('id', id)
    loadOnspots()
  }

  async function deleteOnspot(id: string) {
    await supabase.from('onspot_registrations').delete().eq('id', id)
    loadOnspots()
  }

  const schoolMap: Record<number, string> = {}
  schools.forEach(s => { schoolMap[s.slot_number] = s.school_name })

  const filteredOnspots = onspots.filter(o =>
    onspotFilter === 'all' ? true : onspotFilter === 'paid' ? o.amount_paid : !o.amount_paid
  )

  const filteredEventsByCategory = categories.map(cat => ({
    cat,
    evs: events.filter(e => e.category_id === cat.id &&
      (eventSearch === '' || e.name.toLowerCase().includes(eventSearch.toLowerCase())))
  })).filter(x => x.evs.length > 0)

  const filteredEventsForParticipants = selectedCat ? events.filter(e => e.category_id === selectedCat) : events

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Participants</h2>

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
      </div>

      {tab === 'participants' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => (
              <button key={c.id} onClick={() => { setSelectedCat(c.id); setSelectedEvent('') }}
                className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCat===c.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredEventsForParticipants.map(ev => (
              <div key={ev.id} className="flex items-center gap-1">
                <button onClick={() => setSelectedEvent(ev.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${selectedEvent===ev.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'}`}>
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

          {selectedEvent && participants.length === 0 && (
            <div className="card text-center text-gray-400 py-10">No participants for this event yet.</div>
          )}

          {[...new Set(participants.map(p => p.slot_number))].sort((a,b)=>a-b).map(slot => {
            const slotParts = participants.filter(p => p.slot_number === slot)
            const entries = [...new Set(slotParts.map(p => p.entry_index))].sort((a,b)=>a-b)
            const ev = events.find(e => e.id === selectedEvent)
            return (
              <div key={slot} className="card space-y-2">
                <h3 className="font-semibold text-gray-700">Slot {slot} — {schoolMap[slot] ?? '—'}</h3>
                {entries.map(entry => {
                  const members = slotParts.filter(p => p.entry_index === entry).sort((a,b)=>a.member_index-b.member_index)
                  return (
                    <div key={entry} className="border border-gray-100 rounded-xl overflow-hidden">
                      {ev && ev.max_entries > 1 && (
                        <div className="bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-500">Entry {entry}</div>
                      )}
                      {members.map(p => (
                        <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 first:border-t-0">
                          {editingId === p.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input value={editName} onChange={e => setEditName(e.target.value)} className="input flex-1" autoFocus />
                              <button onClick={async () => { setSaving(true); await supabase.from('participants').update({ participant_name: editName }).eq('id', p.id); setEditingId(null); setSaving(false); loadParticipants(selectedEvent) }} className="btn-primary px-2 py-1"><Check size={14} /></button>
                              <button onClick={() => setEditingId(null)} className="btn-secondary px-2 py-1"><X size={14} /></button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm text-gray-800">{ev?.is_team_event ? `Member ${p.member_index}: ` : ''}{p.participant_name}</span>
                              <div className="flex gap-2">
                                <button onClick={() => { setEditingId(p.id); setEditName(p.participant_name) }} className="text-gray-400 hover:text-brand-600"><Pencil size={14} /></button>
                                <button onClick={async () => { await supabase.from('participants').delete().eq('id', p.id); loadParticipants(selectedEvent) }} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
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
                  <button onClick={() => deleteOnspot(o.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
