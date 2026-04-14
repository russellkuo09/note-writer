'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { createClient, isDemoMode } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Logo from '@/components/Logo'
import { HOSPITALS, HOSPITAL_SLUGS, MINUTES_PER_NOTE } from '@/types'
import type { Hospital, Note, NoteStatus } from '@/types'

interface SchoolStat {
  school: string
  volunteers: number
  totalNotes: number
  monthNotes: number
}

// Demo notes for when Supabase is not connected
const DEMO_NOTES: Note[] = [
  { id: '1', author_id: 'u1', author_name: 'Sarah M.', hospital: 'shriners', patient_prompt: 'surgery', body: "Hey Fighter — I don't know your name but someone out here is rooting for you. You've got this. Keep fighting. 🌷", status: 'queued', created_at: new Date(Date.now() - 3600000).toISOString(), printed_at: null, dedication: null },
  { id: '2', author_id: 'u2', author_name: 'James K.', hospital: 'shriners', patient_prompt: 'teenager', body: "Being in the hospital is really hard. But you're harder. I can tell. Keep going — we're cheering for you every single day.", status: 'queued', created_at: new Date(Date.now() - 7200000).toISOString(), printed_at: null, dedication: null },
  { id: '3', author_id: 'u3', author_name: 'Emily R.', hospital: 'whittier', patient_prompt: 'animals', body: "I heard you love animals. Did you know even the smallest creatures never give up? Just like you. You're amazing. 🌷", status: 'queued', created_at: new Date(Date.now() - 10800000).toISOString(), printed_at: null, dedication: null },
  { id: '4', author_id: 'u4', author_name: 'Tyler B.', hospital: 'healthbridge', patient_prompt: 'surgery', body: "You might be in a tough spot right now, but you're a fighter. Every single day is a victory. We're rooting for you!", status: 'printed', created_at: new Date(Date.now() - 86400000).toISOString(), printed_at: new Date(Date.now() - 3600000).toISOString(), dedication: null },
  { id: '5', author_id: 'u5', author_name: 'Maya L.', hospital: 'pvhmc', patient_prompt: 'teenager', body: "Some days are harder than others. But I want you to know — you are seen, you are loved, and you are so incredibly brave.", status: 'queued', created_at: new Date().toISOString(), printed_at: null, dedication: null },
]

export default function AdminPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeTab, setActiveTab] = useState<Hospital | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)

  // Print config modal
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printCount, setPrintCount] = useState(1)
  const [printOrder, setPrintOrder] = useState<'oldest' | 'newest'>('oldest')
  const [selectedBranding, setSelectedBranding] = useState<'flowers' | 'notes'>('flowers')

  // After print — track which IDs were in the batch
  const [lastPrintedIds, setLastPrintedIds] = useState<string[]>([])
  const [confirmPrint, setConfirmPrint] = useState(false)

  // Password reset
  const [resetEmail, setResetEmail] = useState('')
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // School stats
  const [schoolStats, setSchoolStats] = useState<SchoolStat[]>([])
  const [schoolStatsLoaded, setSchoolStatsLoaded] = useState(false)

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
      fetch('/api/admin/school-stats')
        .then(r => r.json())
        .then(data => { setSchoolStats(Array.isArray(data) ? data : []); setSchoolStatsLoaded(true) })
        .catch(() => setSchoolStatsLoaded(true))
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

  // Queued notes for the active tab, sorted by the chosen order
  function getQueuedNotes(order: 'oldest' | 'newest') {
    const targetHospital = activeTab === 'all' ? null : activeTab
    const filtered = notes.filter(
      (n) => n.status === 'queued' && (targetHospital === null || n.hospital === targetHospital)
    )
    return filtered.sort((a, b) =>
      order === 'oldest'
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  function openPrintModal() {
    const total = getQueuedNotes('oldest').length
    if (total === 0) return
    setPrintCount(total) // default: all
    setPrintOrder('oldest')
    setShowPrintModal(true)
  }

  async function executePrint() {
    setShowPrintModal(false)
    const sorted = getQueuedNotes(printOrder)
    const batch = sorted.slice(0, printCount)
    if (batch.length === 0) return

    setPrinting(true)
    try {
      const targetHospital = activeTab === 'all' ? null : activeTab
      const res = await fetch('/api/admin/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteIds: batch.map((n) => n.id),
          hospital: targetHospital,
          notes: batch,
          branding: selectedBranding,
        }),
      })
      if (!res.ok) throw new Error()
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const tab = window.open(url, '_blank')
      if (!tab) {
        const a = document.createElement('a')
        a.href = url
        a.download = `fff-notes-${targetHospital ?? 'all'}-${new Date().toISOString().slice(0, 10)}.html`
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setLastPrintedIds(batch.map((n) => n.id))
      setConfirmPrint(true)
    } catch {
      alert('Error preparing cards — please try again.')
    } finally {
      setPrinting(false)
    }
  }

  async function confirmMarkPrinted() {
    if (demoMode) {
      setNotes((prev) =>
        prev.map((n) =>
          lastPrintedIds.includes(n.id) ? { ...n, status: 'printed', printed_at: new Date().toISOString() } : n
        )
      )
    } else {
      await Promise.all(lastPrintedIds.map((id) => updateStatus(id, 'printed')))
    }
    setLastPrintedIds([])
    setConfirmPrint(false)
  }

  const filteredNotes = notes.filter(
    (n) => activeTab === 'all' || n.hospital === activeTab
  )

  const queuedCount = (hospital?: Hospital) =>
    notes.filter((n) => n.status === 'queued' && (!hospital || n.hospital === hospital)).length

  const activeNotes = notes.filter(n => n.status !== 'archived')
  const totalHours = Math.floor((activeNotes.length * MINUTES_PER_NOTE) / 60)
  const totalMins = (activeNotes.length * MINUTES_PER_NOTE) % 60

  // Live preview values for the print modal
  const modalQueued = getQueuedNotes(printOrder).length
  const safePrintCount = Math.min(Math.max(1, printCount), modalQueued)
  const hospitalLabel = activeTab === 'all' ? 'all hospitals' : HOSPITALS[activeTab]

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

      {/* ── Print config modal ── */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-fade-in-up space-y-5">
            <div className="text-center">
              <h3 className="font-display text-xl font-semibold text-charcoal mb-1">Print notes</h3>
              <p className="font-body text-xs text-charcoal/50">{modalQueued} queued for {hospitalLabel}</p>
            </div>

            {/* Count */}
            <div>
              <label className="font-body text-sm font-semibold text-charcoal block mb-1.5">
                How many notes to print?
              </label>
              <input
                type="number"
                min={1}
                max={modalQueued}
                value={printCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 1
                  setPrintCount(Math.min(Math.max(1, v), modalQueued))
                }}
                className="w-full border border-cream-dark rounded-2xl px-4 py-2.5 font-body text-sm text-charcoal focus:outline-none focus:border-primary"
              />
            </div>

            {/* Order */}
            <div>
              <label className="font-body text-sm font-semibold text-charcoal block mb-1.5">
                Start from:
              </label>
              <select
                value={printOrder}
                onChange={(e) => setPrintOrder(e.target.value as 'oldest' | 'newest')}
                className="w-full border border-cream-dark rounded-2xl px-4 py-2.5 font-body text-sm text-charcoal focus:outline-none focus:border-primary bg-white"
              >
                <option value="oldest">Oldest first (first note submitted)</option>
                <option value="newest">Newest first (most recent note submitted)</option>
              </select>
            </div>

            {/* Branding */}
            <div>
              <label className="font-body text-sm font-semibold text-charcoal block mb-1.5">
                Card branding:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedBranding('flowers')}
                  className={`rounded-2xl p-3 border-2 text-left transition-all ${selectedBranding === 'flowers' ? 'border-primary bg-blush/30' : 'border-cream-dark bg-white'}`}
                >
                  <p style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 700, fontSize: 13, color: '#E8637A', lineHeight: 1.2 }} className="mb-0.5">
                    Flowers for Fighters
                  </p>
                  <p className="font-body text-xs text-charcoal/40">Bouquet deliveries 🌷</p>
                </button>
                <button
                  onClick={() => setSelectedBranding('notes')}
                  className={`rounded-2xl p-3 border-2 text-left transition-all ${selectedBranding === 'notes' ? 'border-primary bg-blush/30' : 'border-cream-dark bg-white'}`}
                >
                  <p style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 700, fontSize: 13, color: '#E8637A', lineHeight: 1.2 }} className="mb-0.5">
                    Notes for Fighters
                  </p>
                  <p className="font-body text-xs text-charcoal/40">Notes-only deliveries ✉️</p>
                </button>
              </div>
            </div>

            {/* Live preview line */}
            <p className="font-body text-xs text-charcoal/50 text-center bg-cream rounded-2xl px-3 py-2">
              This will print notes <span className="font-semibold text-charcoal">1 to {safePrintCount}</span> of{' '}
              <span className="font-semibold text-charcoal">{modalQueued}</span> queued notes for{' '}
              <span className="font-semibold text-charcoal">{hospitalLabel}</span>
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 py-3 rounded-2xl font-body font-semibold text-charcoal/60 border border-cream-dark"
              >
                Cancel
              </button>
              <button
                onClick={executePrint}
                className="flex-1 py-3 rounded-2xl font-body font-semibold text-white bg-primary"
                style={{ boxShadow: '0 4px 16px rgba(232,99,122,0.3)' }}
              >
                Print {safePrintCount} {safePrintCount === 1 ? 'note' : 'notes'} 🖨️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm mark printed modal ── */}
      {confirmPrint && (
        <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-fade-in-up">
            <h3 className="font-display text-xl font-semibold text-charcoal mb-2">Mark as Printed?</h3>
            <p className="font-body text-charcoal/60 text-sm mb-4">
              Mark these <span className="font-semibold text-charcoal">{lastPrintedIds.length}</span> notes as printed?
              The remaining queued notes will stay in the queue.
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
                Yes, mark {lastPrintedIds.length} printed
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
            <p className="font-display text-2xl font-bold text-charcoal">{activeNotes.length}</p>
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
            onClick={openPrintModal}
            disabled={printing}
            className="w-full py-3.5 rounded-2xl bg-charcoal text-white font-body font-bold text-sm transition-all active:scale-95 disabled:opacity-60 animate-fade-in-up stagger-2"
          >
            {printing
              ? '⏳ Preparing cards...'
              : `🖨️ Print Batch for ${activeTab === 'all' ? 'All Hospitals' : HOSPITALS[activeTab]} (${queuedCount(activeTab === 'all' ? undefined : activeTab)} queued)`}
          </button>
        )}

        {/* Volunteer Hours */}
        <button
          onClick={() => window.open('/admin/volunteers', '_blank')}
          className="w-full py-3 rounded-2xl bg-white text-charcoal/70 font-body font-semibold text-sm border border-cream-dark hover:border-primary/30 transition-all animate-fade-in-up stagger-2"
        >
          📊 Volunteer Hours
        </button>

        {/* Schools breakdown */}
        <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden animate-fade-in-up stagger-2">
          <div className="px-4 py-3 border-b border-cream-dark flex items-center justify-between">
            <p className="font-body text-sm font-semibold text-charcoal">🏫 Schools</p>
            <p className="font-body text-xs text-charcoal/40">{schoolStats.length} school{schoolStats.length !== 1 ? 's' : ''}</p>
          </div>
          {!schoolStatsLoaded ? (
            <div className="py-6 text-center">
              <span className="text-2xl animate-pulse-soft block">🏫</span>
            </div>
          ) : schoolStats.length === 0 ? (
            <div className="py-6 text-center">
              <p className="font-body text-xs text-charcoal/40">No school data yet — volunteers can add their school when signing up.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-cream-dark bg-cream/50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">School</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Volunteers</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">All-time notes</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">This month</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolStats.map((s) => (
                    <tr key={s.school} className="border-b border-cream-dark last:border-0 hover:bg-cream/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-charcoal text-sm">{s.school}</td>
                      <td className="px-3 py-3 text-center text-charcoal/70">{s.volunteers}</td>
                      <td className="px-3 py-3 text-center font-bold text-primary">{s.totalNotes}</td>
                      <td className="px-3 py-3 text-center">
                        {s.monthNotes > 0
                          ? <span className="font-semibold text-sage">{s.monthNotes}</span>
                          : <span className="text-charcoal/30">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Password reset tool */}
        <div className="bg-white rounded-2xl border border-cream-dark p-4 animate-fade-in-up stagger-2">
          <p className="font-body text-sm font-semibold text-charcoal mb-3">🔑 Send Password Reset Email</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => { setResetEmail(e.target.value); setResetState('idle') }}
              placeholder="volunteer@email.com"
              className="flex-1 border border-cream-dark rounded-xl px-3 py-2 font-body text-sm text-charcoal focus:outline-none focus:border-primary"
            />
            <button
              disabled={!resetEmail || resetState === 'sending'}
              onClick={async () => {
                setResetState('sending')
                const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                  redirectTo: `${window.location.origin}/`,
                })
                setResetState(error ? 'error' : 'sent')
              }}
              className="px-4 py-2 rounded-xl font-body font-semibold text-sm text-white bg-primary disabled:opacity-50 transition-all"
              style={{ boxShadow: '0 2px 8px rgba(232,99,122,0.25)' }}
            >
              {resetState === 'sending' ? '...' : 'Send'}
            </button>
          </div>
          {resetState === 'sent' && (
            <p className="font-body text-xs text-sage mt-2">✓ Reset email sent to {resetEmail}</p>
          )}
          {resetState === 'error' && (
            <p className="font-body text-xs text-red-400 mt-2">Something went wrong — check the email address.</p>
          )}
        </div>

        {/* Note cards */}
        <div className="space-y-3 animate-fade-in-up stagger-3">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3">🌷</span>
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
