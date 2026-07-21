'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FileText, ArrowLeft, Save } from 'lucide-react'
import type { Event, Participant } from '@/lib/types'

interface Entry {
  id?: string
  members: string[]
}

export default function EventDetailPage() {
  const params = useParams()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId as string
  const router = useRouter()
  const supabase = createClient()

  const [event, setEvent] = useState<Event | null>(null)
  const [slotNumber, setSlotNumber] = useState<number>(0)
  const [isOpen, setIsOpen] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  function showMessage(msg: string) {
    if (msgTimer.current) clearTimeout(msgTimer.current)
    setMessage(msg)
    msgTimer.current = setTimeout(() => setMessage(''), 3000)
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/login'); return }

      const slot = session.user.user_metadata?.slot_number as number
      if (!slot) { router.push('/login'); return }   // guard: no slot assigned yet
      setSlotNumber(slot)

      const [
        { data: ev, error: evErr },
        { data: participants, error: partErr },
        { data: settings, error: settErr },
      ] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('participants')
          .select('*')
          .eq('event_id', eventId)
          .eq('slot_number', slot)
          .order('entry_index')
          .order('member_index'),
        supabase.from('settings').select('registration_open').maybeSingle(),
      ])

      const loadErr = evErr ?? partErr ?? settErr
      if (loadErr) {
        setMessage(`❌ Failed to load event: ${loadErr.message}`)
        setLoading(false)
        return
      }

      setEvent(ev)
      setIsOpen(settings?.registration_open ?? false)

      if (ev) {
        const memberCount = ev.is_team_event ? (ev.team_size ?? 1) : 1
        const entryCount = ev.max_entries ?? 1
        const built: Entry[] = []

        for (let e = 1; e <= entryCount; e++) {
          const members: string[] = []
          for (let m = 1; m <= memberCount; m++) {
            const found = (participants ?? []).find(
              (p: Participant) => p.entry_index === e && p.member_index === m
            )
            members.push(found?.participant_name ?? '')
          }
          built.push({ members })
        }
        setEntries(built)
      }
      setLoading(false)
    }
    load()
  }, [eventId])

  async function handleSave() {
    if (!event || !slotNumber || !isOpen) return
    setSaving(true)
    setMessage('')

    // Delete existing, then insert fresh
    const { error: deleteError } = await supabase.from('participants')
      .delete()
      .eq('event_id', eventId)
      .eq('slot_number', slotNumber)

    if (deleteError) {
      showMessage(`❌ Error clearing old entries: ${deleteError.message}`)
      setSaving(false)
      return
    }

    const rows = []
    for (let eIdx = 0; eIdx < entries.length; eIdx++) {
      for (let mIdx = 0; mIdx < entries[eIdx].members.length; mIdx++) {
        const name = entries[eIdx].members[mIdx].trim()
        if (name) {
          rows.push({
            slot_number: slotNumber,
            event_id: eventId,
            participant_name: name,
            entry_index: eIdx + 1,
            member_index: mIdx + 1,
          })
        }
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('participants').insert(rows)
      if (error) {
        showMessage(`❌ Error: ${error.message}`)
        console.error('[Save] insert error:', error)
        setSaving(false)
        return
      }
    }

    showMessage('Saved successfully!')
    setSaving(false)
    router.refresh()  // invalidate server-component cache so events list shows correct Filled/Pending status
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  if (!event) return <div className="card text-center text-gray-400">Event not found.</div>

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={15} /> Back to Events
      </button>

      {/* Event Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{event.name}</h2>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              {event.event_date && <span>📅 {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</span>}
              {event.event_time && <span>🕐 {event.event_time}</span>}
              {event.venue && <span>📍 {event.venue}</span>}
            </div>
            <div className="flex gap-3 mt-2 text-sm text-gray-400">
              <span>Max entries: <strong>{event.max_entries}</strong></span>
              {event.is_team_event && <span>Team size: <strong>{event.team_size}</strong></span>}
            </div>
          </div>
          {event.rulebook_url && (
            <a
              href={event.rulebook_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-800 bg-brand-50 px-3 py-2 rounded-lg"
            >
              <FileText size={15} /> Rulebook
            </a>
          )}
        </div>
      </div>

      {/* Rules */}
      {event.rules && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-2">Rules</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.rules}</p>
        </div>
      )}

      {/* Frozen warning */}
      {!isOpen && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
          Registration is closed. Entries are locked and cannot be edited.
        </div>
      )}

      {/* Participant Form */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-800">
          {event.is_team_event ? 'Team Entries' : 'Participant Entries'}
        </h3>

        {entries.map((entry, eIdx) => (
          <div key={eIdx} className="border border-gray-100 rounded-xl p-4 space-y-3">
            {event.max_entries > 1 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Entry {eIdx + 1}
              </p>
            )}
            {entry.members.map((name, mIdx) => (
              <div key={mIdx}>
                <label className="block text-xs text-gray-500 mb-1">
                  {event.is_team_event ? `Member ${mIdx + 1}` : 'Participant Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => {
                    if (!isOpen) return
                    const val = e.target.value
                    setEntries(prev => prev.map((en, ei) =>
                      ei === eIdx
                        ? { ...en, members: en.members.map((m, mi) => mi === mIdx ? val : m) }
                        : en
                    ))
                  }}
                  className="input"
                  placeholder={event.is_team_event ? `Team member ${mIdx + 1} name` : 'Participant full name'}
                  disabled={!isOpen}
                />
              </div>
            ))}
          </div>
        ))}

        {/* Save */}
        {isOpen && (
          <div className="flex items-center gap-4 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={15} />
              {saving ? 'Saving…' : 'Save Entries'}
            </button>
            {message && (
              <span className={`text-sm font-medium ${message.startsWith('❌') ? 'text-red-600' : 'text-green-600'}`}>
                {message}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
