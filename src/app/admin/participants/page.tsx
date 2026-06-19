'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Pencil, Trash2, Check, X, FileDown } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Category, Event } from '@/lib/types'

export default function AdminParticipantsPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')

  // Edit state: participantId → editName
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const [{ data: cats }, { data: evs }, { data: sc }] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('events').select('*').order('name'),
      supabase.from('schools').select('slot_number, school_name'),
    ])
    setCategories(cats ?? [])
    setEvents(evs ?? [])
    setSchools(sc ?? [])
    if (!selectedCat && cats?.[0]) setSelectedCat(cats[0].id)
  }

  async function loadParticipants(eventId: string) {
    if (!eventId) { setParticipants([]); return }
    const { data } = await supabase
      .from('participants').select('*')
      .eq('event_id', eventId)
      .order('slot_number').order('entry_index').order('member_index')
    setParticipants(data ?? [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (selectedEvent) loadParticipants(selectedEvent) }, [selectedEvent])

  const schoolMap: Record<number, string> = {}
  schools.forEach(s => { schoolMap[s.slot_number] = s.school_name })

  const eventsInCat = events.filter(e => e.category_id === selectedCat)
  const selectedEventObj = events.find(e => e.id === selectedEvent)

  function startEdit(p: any) {
    setEditingId(p.id)
    setEditName(p.participant_name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
  }

  async function saveEdit(participantId: string) {
    if (!editName.trim()) return
    setSaving(true)
    await supabase.from('participants').update({ participant_name: editName.trim() }).eq('id', participantId)
    setEditingId(null)
    setEditName('')
    setMessage('Name updated.')
    setTimeout(() => setMessage(''), 2500)
    await loadParticipants(selectedEvent)
    setSaving(false)
  }

  async function deleteParticipant(p: any) {
    if (!confirm(`Delete "${p.participant_name}" from this event?`)) return
    setSaving(true)
    await supabase.from('participants').delete().eq('id', p.id)
    setMessage('Participant removed.')
    setTimeout(() => setMessage(''), 2500)
    await loadParticipants(selectedEvent)
    setSaving(false)
  }

  async function exportPDFForEvent(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    // Load participants for this event (may differ from currently selected)
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

    // Build flat rows for the table
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

  const filteredEvents = selectedCat ? events.filter(e => e.category_id === selectedCat) : events
  const slots = [...new Set(participants.map(p => p.slot_number))].sort((a, b) => a - b)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Participants</h2>
        {selectedEvent && (
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
        const entries = [...new Set(slotParts.map(p => p.entry_index))].sort((a, b) => a - b)
        return (
          <div key={slot} className="card space-y-3">
            <h3 className="font-semibold text-gray-700">Slot {slot} — {schoolMap[slot] ?? '—'}</h3>
            {entries.map(entry => {
              const members = slotParts.filter(p => p.entry_index === entry).sort((a, b) => a.member_index - b.member_index)
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
                            onKeyDown={async e => { if (e.key === 'Enter') { setSaving(true); await supabase.from('participants').update({ participant_name: editName }).eq('id', p.id); setEditingId(null); setSaving(false); loadParticipants(selectedEvent) } }}
                          />
                          <button onClick={async () => { setSaving(true); await supabase.from('participants').update({ participant_name: editName }).eq('id', p.id); setEditingId(null); setSaving(false); loadParticipants(selectedEvent) }} className="btn-primary px-2 py-1"><Check size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="btn-secondary px-2 py-1"><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm text-gray-800">{selectedEventObj?.is_team_event ? `Member ${p.member_index}: ` : ''}{p.participant_name}</span>
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
  )
}
