'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient, isDemoMode } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Logo from '@/components/Logo'
import { HOSPITALS, HOSPITAL_SLUGS, MINUTES_PER_NOTE } from '@/types'
import type { Hospital, Note, NoteStatus } from '@/types'

// Demo notes for when Supabase is not connected
const DEMO_NOTES: Note[] = [
  { id: '1', author_id: 'u1', author_name: 'Sarah M.', hospital: 'shriners', patient_prompt: 'surgery', body: "Hey Fighter — I don't know your name but someone out here is rooting for you. You've got this. Keep fighting. 🌸", status: 'queued', created_at: new Date(Date.now() - 3600000).toISOString(), printed_at: null },
  { id: '2', author_id: 'u2', author_name: 'James K.', hospital: 'shriners', patient_prompt: 'teenager', body: "Being in the hospital is really hard. But you're harder. I can tell. Keep going — we're cheering for you every single day.", status: 'queued', created_at: new Date(Date.now() - 7200000).toISOString(), printed_at: null },
  { id: '3', author_id: 'u3', author_name: 'Emily R.', hospital: 'whittier', patient_prompt: 'animals', body: "I heard you love animals. Did you know even the smallest creatures never give up? Just like you. You're amazing. 🌸", status: 'queued', created_at: new Date(Date.now() - 10800000).toISOString(), printed_at: null },
  { id: '4', author_id: 'u4', author_name: 'Tyler B.', hospital: 'healthbridge', patient_prompt: 'surgery', body: "You might be in a tough spot right now, but you're a fighter. Every single day is a victory. We're rooting for you!", status: 'printed', created_at: new Date(Date.now() - 86400000).toISOString(), printed_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '5', author_id: 'u5', author_name: 'Maya L.', hospital: 'pvhmc', patient_prompt: 'teenager', body: "Some days are harder than others. But I want you to know — you are seen, you are loved, and you are so incredibly brave.", status: 'queued', created_at: new Date().toISOString(), printed_at: null },
]

export default function AdminPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeTab, setActiveTab] = useState<Hospital | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [confirmPrint, setConfirmPrint] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const router = useRouter()
  const demoMode = isDemoMode()
  const supabase = createClient()

  useEffect(() => {
    if (demoMode) {
      setNotes(DEMO_NOTES)
      setLoading(false)
      return
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }


      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        setUnauthorized(true)
        setLoading(false)
        return
      }

      fetchNotes()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchNotes() {
    if (demoMode) return
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
    setNotes(data ?? [])
    setLoading(false)
  }

  async function updateStatus(noteId: string, status: NoteStatus) {
    if (demoMode) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, status, printed_at: status === 'printed' ? new Date().toISOString() : n.printed_at }
            : n
        )
      )
      return
    }
    await fetch('/api/admin/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteId, status }),
    })
    fetchNotes()
  }

  async function handleBatchPrint() {
    const targetHospital = activeTab === 'all' ? null : activeTab
    const queuedNotes = notes.filter(
      (n) => n.status === 'queued' && (targetHospital === null || n.hospital === targetHospital)
    )

    if (queuedNotes.length === 0) return

    setPrinting(true)
    try {
      const res = await fetch('/api/admin/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteIds: queuedNotes.map((n) => n.id),
          hospital: targetHospital,
          notes: queuedNotes,
        }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fff-notes-${targetHospital ?? 'all'}-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setConfirmPrint(true)
    } catch {
      alert('Error generating PDF — please try again.')
    } finally {
      setPrinting(false)
    }
  }

  async function confirmMarkPrinted() {
    const targetHospital = activeTab === 'all' ? null : activeTab
    const queuedIds = notes
      .filter((n) => n.status === 'queued' && (targetHospital === null || n.hospital === targetHospital))
      .map((n) => n.id)

    if (demoMode) {
      setNotes((prev) =>
        prev.map((n) =>
          queuedIds.includes(n.id) ? { ...n, status: 'printed', printed_at: new Date().toISOString() } : n
        )
      )
    } else {
      await Promise.all(queuedIds.map((id) => updateStatus(id, 'printed')))
    }
    setConfirmPrint(false)
  }

  const filteredNotes = notes.filter(
    (n) => activeTab === 'all' || n.hospital === activeTab
  )

  const queuedCount = (hospital?: Hospital) =>
    notes.filter((n) => n.status === 'queued' && (!hospital || n.hospital === hospital)).length

  const totalHours = Math.floor((notes.length * MINUTES_PER_NOTE) / 60)
  const totalMins = (notes.length * MINUTES_PER_NOTE) % 60

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-4xl animate-pulse-soft">📋</span>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-4">🔒</span>
        <h2 className="font-display text-2xl font-semibold text-charcoal mb-2">Admin only</h2>
        <p className="font-body text-charcoal/60 mb-6">You need admin access to view this page.</p>
        <button onClick={() => router.push('/')} className="text-primary font-body font-semibold">
          ← Back to Write
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Confirm print modal */}
      {confirmPrint && (
        <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-fade-in-up">
            <h3 className="font-display text-xl font-semibold text-charcoal mb-2">Mark as Printed?</h3>
            <p className="font-body text-charcoal/60 text-sm mb-4">
              Move all queued notes for{' '}
              {activeTab === 'all' ? 'all hospitals' : HOSPITALS[activeTab]} to &quot;Printed&quot;?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmPrint(false)}
                className="flex-1 py-3 rounded-2xl font-body font-semibold text-charcoal/60 border border-cream-dark"
              >
                Not yet
              </button>
              <button
                onClick={confirmMarkPrinted}
                className="flex-1 py-3 rounded-2xl font-body font-semibold text-white bg-primary"
              >
                Yes, mark printed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-cream-dark px-4 py-3 safe-top">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <span className="font-body text-xs text-charcoal/50 bg-sage/20 text-sage px-2 py-1 rounded-full font-semibold">
            Admin Queue
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in-up">
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-primary">{queuedCount()}</p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">Queued</p>
          </div>
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-charcoal">{notes.length}</p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">All-time notes</p>
          </div>
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-sage">
              {totalHours > 0 ? `${totalHours}h` : `${totalMins}m`}
            </p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">Vol. hours</p>
          </div>
        </div>

        {/* Hospital tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 animate-fade-in-up stagger-1">
          {(['all', ...HOSPITAL_SLUGS] as const).map((h) => {
            const count = h === 'all' ? queuedCount() : queuedCount(h)
            return (
              <button
                key={h}
                onClick={() => setActiveTab(h)}
                className={`flex-shrink-0 px-3 py-2 rounded-2xl text-sm font-body font-semibold transition-all border ${
                  activeTab === h
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-charcoal/70 border-cream-dark'
                }`}
              >
                {h === 'all' ? 'All' : HOSPITALS[h]}
                {count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === h ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Batch print button */}
        {queuedCount(activeTab === 'all' ? undefined : activeTab) > 0 && (
          <button
            onClick={handleBatchPrint}
            disabled={printing}
            className="w-full py-3.5 rounded-2xl bg-charcoal text-white font-body font-bold text-sm transition-all active:scale-95 disabled:opacity-60 animate-fade-in-up stagger-2"
          >
            {printing
              ? '⏳ Generating PDF...'
              : `🖨️ Print Batch for ${activeTab === 'all' ? 'All Hospitals' : HOSPITALS[activeTab]} (${queuedCount(activeTab === 'all' ? undefined : activeTab)} notes)`}
          </button>
        )}

        {/* Export CSV */}
        <button
          onClick={async () => {
            const res = await fetch('/api/export/csv')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `fff-volunteer-hours-${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="w-full py-3 rounded-2xl bg-white text-charcoal/70 font-body font-semibold text-sm border border-cream-dark hover:border-primary/30 transition-all animate-fade-in-up stagger-2"
        >
          📊 Export Volunteer Hours CSV
        </button>

        {/* Note cards */}
        <div className="space-y-3 animate-fade-in-up stagger-3">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3">🌸</span>
              <p className="font-body text-charcoal/50">No notes here yet</p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdateStatus={updateStatus}
              />
            ))
          )}
        </div>
      </div>

      <Navigation isAdmin />
    </div>
  )
}

function NoteCard({
  note,
  onUpdateStatus,
}: {
  note: Note
  onUpdateStatus: (id: string, status: NoteStatus) => void
}) {
  const statusColors: Record<NoteStatus, string> = {
    queued: 'bg-sage/20 text-sage',
    printed: 'bg-charcoal/10 text-charcoal/60',
    archived: 'bg-red-100 text-red-500',
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-dark p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="font-body font-semibold text-sm text-charcoal">{note.author_name}</span>
          <span className="font-body text-xs text-charcoal/40 ml-2">
            {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-1 rounded-full font-body font-semibold ${statusColors[note.status]}`}>
            {note.status}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-blush text-primary font-body font-medium">
            {HOSPITALS[note.hospital]}
          </span>
        </div>
      </div>

      {note.patient_prompt && (
        <p className="text-xs font-body text-charcoal/40 italic mb-2">
          For: {note.patient_prompt}
        </p>
      )}

      <p className="font-body text-sm text-charcoal/80 leading-relaxed mb-3">
        {note.body}
      </p>

      <div className="flex gap-2">
        {note.status === 'queued' && (
          <>
            <button
              onClick={() => onUpdateStatus(note.id, 'printed')}
              className="flex-1 py-2 rounded-xl font-body font-semibold text-xs bg-sage/20 text-sage border border-sage/20"
            >
              ✓ Mark Printed
            </button>
            <button
              onClick={() => onUpdateStatus(note.id, 'archived')}
              className="px-3 py-2 rounded-xl font-body font-semibold text-xs bg-cream text-charcoal/50 border border-cream-dark"
            >
              Archive
            </button>
          </>
        )}
        {note.status === 'printed' && (
          <button
            onClick={() => onUpdateStatus(note.id, 'archived')}
            className="px-3 py-2 rounded-xl font-body font-semibold text-xs bg-cream text-charcoal/50 border border-cream-dark"
          >
            Archive
          </button>
        )}
        {note.status === 'archived' && (
          <button
            onClick={() => onUpdateStatus(note.id, 'queued')}
            className="px-3 py-2 rounded-xl font-body font-semibold text-xs bg-blush text-primary border border-primary/20"
          >
            Restore
          </button>
        )}
      </div>
    </div>
  )
}
