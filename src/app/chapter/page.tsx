'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Logo from '@/components/Logo'
import NoteActivityGraph from '@/components/NoteActivityGraph'
import { HOSPITALS } from '@/types'
import type { Note } from '@/types'

interface LeaderboardEntry {
  name: string
  noteCount: number
}

interface ChapterStats {
  totalNotes: number
  thisMonthNotes: number
  volunteerCount: number
  leaderboard: LeaderboardEntry[]
}

interface SchoolStat {
  school: string
  volunteers: number
  totalNotes: number
  monthNotes: number
}

export default function ChapterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-4xl animate-pulse-soft">🌷</span>
      </div>
    }>
      <ChapterContent />
    </Suspense>
  )
}

function ChapterContent() {
  const [notes, setNotes] = useState<Note[]>([])
  const [stats, setStats] = useState<ChapterStats | null>(null)
  const [school, setSchool] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allSchools, setAllSchools] = useState<SchoolStat[]>([])
  const [selectedSchool, setSelectedSchool] = useState<string>('')

  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printCount, setPrintCount] = useState(1)
  const [printOrder, setPrintOrder] = useState<'oldest' | 'newest'>('oldest')
  const [printing, setPrinting] = useState(false)
  const [lastPrintedIds, setLastPrintedIds] = useState<string[]>([])
  const [confirmPrint, setConfirmPrint] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'admin') {
        setIsAdmin(true)
        // Load all schools for the picker
        const res = await fetch('/api/admin/school-stats')
        if (res.ok) {
          const data: SchoolStat[] = await res.json()
          setAllSchools(data)
          // Pre-select school from query param if present
          const schoolParam = searchParams.get('school')
          if (schoolParam) {
            setSelectedSchool(schoolParam)
            await loadChapterData(schoolParam)
          } else if (data.length > 0) {
            setSelectedSchool(data[0].school)
            await loadChapterData(data[0].school)
          } else {
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      } else {
        await loadChapterData()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadChapterData = useCallback(async (schoolOverride?: string) => {
    setLoading(true)
    const url = schoolOverride
      ? `/api/chapter/notes?school=${encodeURIComponent(schoolOverride)}`
      : '/api/chapter/notes'
    const res = await fetch(url)
    if (res.status === 401) {
      setUnauthorized(true)
      setLoading(false)
      return
    }
    const data = await res.json()
    setSchool(data.school ?? null)
    setNotes(data.notes ?? [])
    setStats(data.stats ?? null)
    setLoading(false)
  }, [])

  async function handleSchoolChange(s: string) {
    setSelectedSchool(s)
    await loadChapterData(s)
  }

  // ── Print helpers ─────────────────────────────────────────────────────────
  const queuedNotes = notes.filter(n => n.status === 'queued')
  const sortedForPrint = [...queuedNotes].sort((a, b) =>
    printOrder === 'oldest'
      ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const safePrintCount = Math.min(Math.max(1, printCount), queuedNotes.length)

  function openPrintModal() {
    if (queuedNotes.length === 0) return
    setPrintCount(queuedNotes.length)
    setPrintOrder('oldest')
    setShowPrintModal(true)
  }

  async function executePrint() {
    setShowPrintModal(false)
    const batch = sortedForPrint.slice(0, safePrintCount)
    if (batch.length === 0) return
    setPrinting(true)
    try {
      const res = await fetch('/api/admin/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: batch, hospital: null, branding: 'flowers' }),
      })
      if (!res.ok) throw new Error('Print failed')
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setLastPrintedIds(batch.map(n => n.id))
      setConfirmPrint(true)
    } catch {
      alert('Something went wrong generating the print file.')
    } finally {
      setPrinting(false)
    }
  }

  async function confirmMarkPrinted() {
    const supabaseClient = createClient()
    await Promise.all(
      lastPrintedIds.map(id =>
        supabaseClient.from('notes').update({ status: 'printed', printed_at: new Date().toISOString() }).eq('id', id)
      )
    )
    setNotes(prev => prev.map(n =>
      lastPrintedIds.includes(n.id) ? { ...n, status: 'printed' as const, printed_at: new Date().toISOString() } : n
    ))
    setConfirmPrint(false)
    setLastPrintedIds([])
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-4xl animate-pulse-soft">🌷</span>
      </div>
    )
  }

  // ── Unauthorized state ───────────────────────────────────────────────────
  if (unauthorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-4">🔒</span>
        <h2 className="font-display text-2xl font-semibold text-charcoal mb-2">Chapter leads only</h2>
        <p className="font-body text-charcoal/60 mb-6">You need chapter lead access to view this page.</p>
        <button onClick={() => router.push('/')} className="text-primary font-body font-semibold">
          ← Back to Write
        </button>
      </div>
    )
  }

  const rankColors = [
    'bg-yellow-100 text-yellow-700',   // gold
    'bg-gray-100 text-gray-600',        // silver
    'bg-orange-100 text-orange-700',    // bronze
  ]

  return (
    <div className="min-h-screen bg-background pb-32">

      {/* Print config modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-fade-in-up space-y-5">
            <h2 className="font-display text-xl font-bold text-charcoal">Print Notes 🖨️</h2>

            <div className="space-y-2">
              <label className="font-body text-sm font-semibold text-charcoal/70">How many notes?</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={queuedNotes.length}
                  value={printCount}
                  onChange={e => setPrintCount(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="font-display text-lg font-bold text-primary w-8 text-right">{safePrintCount}</span>
              </div>
              <p className="font-body text-xs text-charcoal/40">{queuedNotes.length} queued from your school</p>
            </div>

            <div className="space-y-2">
              <label className="font-body text-sm font-semibold text-charcoal/70">Print order</label>
              <div className="flex gap-2">
                {(['oldest', 'newest'] as const).map(o => (
                  <button key={o} onClick={() => setPrintOrder(o)}
                    className={`flex-1 py-2 rounded-xl font-body text-sm font-semibold border transition-all ${
                      printOrder === o ? 'bg-primary text-white border-primary' : 'bg-white text-charcoal/60 border-cream-dark'
                    }`}
                  >{o === 'oldest' ? 'Oldest first' : 'Newest first'}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPrintModal(false)}
                className="flex-1 py-3 rounded-2xl font-body font-semibold text-sm text-charcoal/60 border border-cream-dark">
                Cancel
              </button>
              <button onClick={executePrint}
                className="flex-1 py-3 rounded-2xl font-body font-bold text-sm text-white bg-primary"
                style={{ boxShadow: '0 4px 16px rgba(232,99,122,0.3)' }}>
                Print {safePrintCount} {safePrintCount === 1 ? 'note' : 'notes'} 🖨️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm printed banner */}
      {confirmPrint && (
        <div className="fixed bottom-24 left-0 right-0 z-50 flex justify-center px-4">
          <div className="bg-charcoal text-white rounded-2xl px-5 py-4 shadow-xl max-w-sm w-full animate-fade-in-up">
            <p className="font-body text-sm font-semibold mb-3">Did the notes print successfully?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmPrint(false)}
                className="flex-1 py-2 rounded-xl font-body text-sm text-white/60 border border-white/20">
                Not yet
              </button>
              <button onClick={confirmMarkPrinted}
                className="flex-1 py-2 rounded-xl font-body font-bold text-sm bg-sage text-white">
                ✓ Mark printed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-cream-dark px-4 py-3 safe-top">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            {/* Print button — chapter leads only (not admin monitoring view) */}
            {!isAdmin && queuedNotes.length > 0 && (
              <button
                onClick={openPrintModal}
                disabled={printing}
                className="font-body text-xs font-semibold px-3 py-1.5 rounded-xl bg-charcoal text-white disabled:opacity-50 transition-all"
              >
                {printing ? '⏳...' : `🖨️ Print (${queuedNotes.length})`}
              </button>
            )}
            <span className={`font-body text-xs px-2 py-1 rounded-full font-semibold ${
              isAdmin ? 'bg-primary/10 text-primary' : 'bg-sage/20 text-sage'
            }`}>
              {isAdmin ? 'Admin View' : 'Chapter Lead'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

        {/* Admin school picker */}
        {isAdmin && allSchools.length > 0 && (
          <div className="bg-white rounded-2xl border border-cream-dark px-4 py-3 animate-fade-in-up">
            <label className="block text-xs font-body font-semibold text-charcoal/50 uppercase tracking-wide mb-2">
              Viewing chapter for
            </label>
            <select
              value={selectedSchool}
              onChange={(e) => handleSchoolChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-cream border border-cream-dark font-body text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {allSchools.map((s) => (
                <option key={s.school} value={s.school}>
                  {s.school} ({s.totalNotes} notes)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Hero card */}
        <div
          className="rounded-3xl p-6 animate-fade-in-up"
          style={{ background: 'linear-gradient(135deg, #E8637A 0%, #F9DDE0 100%)' }}
        >
          <p className="font-body text-white/80 text-sm mb-1">
            {isAdmin ? '👁️ Monitoring Chapter' : '🏫 Chapter Lead Dashboard'}
          </p>
          <p className="font-display text-3xl font-bold text-white mb-1 truncate">
            {school ?? 'Your School'}
          </p>
          <p className="font-display text-6xl font-bold text-white mb-1">
            {stats?.totalNotes ?? 0}
          </p>
          <p className="font-body text-white/90 text-base">
            {(stats?.totalNotes ?? 0) === 1 ? 'note written' : 'notes written'}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in-up stagger-1">
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-primary">{stats?.totalNotes ?? 0}</p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">Total notes</p>
          </div>
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-charcoal">{stats?.thisMonthNotes ?? 0}</p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">This month</p>
          </div>
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-sage">{stats?.volunteerCount ?? 0}</p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">Volunteers</p>
          </div>
        </div>

        {/* Note Activity Graph */}
        {school && (
          <div className="bg-white rounded-3xl border border-cream-dark p-4 animate-fade-in-up stagger-2">
            <NoteActivityGraph
              lockedSchool={school}
              title={`${school} Note Activity`}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {/* Notes list card */}
        <div className="bg-white rounded-3xl border border-cream-dark overflow-hidden animate-fade-in-up stagger-2">
          <div className="px-5 py-4 border-b border-cream-dark flex items-center justify-between">
            <p className="font-body text-sm font-semibold text-charcoal">Notes from this school</p>
            <p className="font-body text-xs text-charcoal/40">{notes.length} total</p>
          </div>
          {notes.length === 0 ? (
            <div className="py-10 text-center">
              <span className="text-3xl block mb-2">🌱</span>
              <p className="font-body text-sm text-charcoal/50">No notes yet — invite your school to write!</p>
            </div>
          ) : (
            <div className="divide-y divide-cream-dark max-h-96 overflow-y-auto scrollbar-hide">
              {notes.map((note) => {
                const firstName = note.author_name?.split(' ')[0] ?? 'Volunteer'
                const dateStr = new Date(note.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
                const hospitalLabel = HOSPITALS[note.hospital] ?? note.hospital
                const truncatedBody =
                  note.body.length > 80 ? note.body.slice(0, 80) + '…' : note.body

                return (
                  <div key={note.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-body text-sm font-semibold text-charcoal">{firstName}</span>
                        <span className="font-body text-xs text-charcoal/40">{dateStr}</span>
                        <span className="font-body text-xs text-primary bg-blush px-1.5 py-0.5 rounded-full">
                          {hospitalLabel}
                        </span>
                      </div>
                      <p className="font-body text-sm text-charcoal/60 leading-snug">{truncatedBody}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Leaderboard card */}
        <div className="bg-white rounded-3xl border border-cream-dark overflow-hidden animate-fade-in-up stagger-3">
          <div className="px-5 py-4 border-b border-cream-dark">
            <p className="font-body text-sm font-semibold text-charcoal">Top Writers 🏆</p>
          </div>
          {!stats?.leaderboard?.length ? (
            <div className="py-10 text-center">
              <p className="font-body text-sm text-charcoal/50">No data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-cream-dark">
              {stats.leaderboard.map((entry, index) => {
                const pillClass = index < 3 ? rankColors[index] : 'bg-cream text-charcoal/60'
                return (
                  <div key={entry.name} className="px-5 py-3 flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-body shrink-0 ${pillClass}`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-body text-sm text-charcoal flex-1">{entry.name}</span>
                    <span className="font-body text-sm font-semibold text-primary">
                      {entry.noteCount} 🌷
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      <Navigation isAdmin={isAdmin} isChapterLead={!isAdmin} />
    </div>
  )
}
