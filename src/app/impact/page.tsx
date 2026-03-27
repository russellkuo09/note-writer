'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { createClient, isDemoMode } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Logo from '@/components/Logo'
import { HOSPITALS, MINUTES_PER_NOTE, BADGES } from '@/types'
import type { Note, Hospital } from '@/types'

// ── Demo data ─────────────────────────────────────────────────────────────
const DEMO_NOTES: Note[] = [
  { id: '1', author_id: 'demo', author_name: 'Demo', hospital: 'shriners', patient_prompt: 'surgery', body: "Hey Fighter — I don't know your name but I want you to know someone out here is rooting for you. Keep fighting. 🌸", status: 'printed', created_at: new Date(Date.now() - 86400000 * 2).toISOString(), printed_at: null },
  { id: '2', author_id: 'demo', author_name: 'Demo', hospital: 'whittier', patient_prompt: 'teenager', body: "You are braver than you know. Keep going — there are people you've never met cheering for you every single day.", status: 'queued', created_at: new Date(Date.now() - 86400000).toISOString(), printed_at: null },
  { id: '3', author_id: 'demo', author_name: 'Demo', hospital: 'healthbridge', patient_prompt: 'animals', body: "I heard you love animals. Did you know even the most determined little critters never give up? Just like you. 🌸", status: 'queued', created_at: new Date().toISOString(), printed_at: null },
]

export default function ImpactPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ name: string; role: string } | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [generatingCard, setGeneratingCard] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const demoMode = isDemoMode()
  const supabase = createClient()

  useEffect(() => {
    if (demoMode) {
      setUser({ id: 'demo', email: 'demo@example.com' } as User)
      setProfile({ name: 'Demo', role: 'admin' })
      fetchNotes('demo')
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      fetchProfile(user.id)
      fetchNotes(user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchProfile(userId: string) {
    if (demoMode) { setProfile({ name: 'Demo User', role: 'supporter' }); return }
    const { data } = await supabase.from('profiles').select('name, role').eq('id', userId).single()
    if (data) setProfile(data)
  }

  async function fetchNotes(userId: string) {
    if (demoMode) { setNotes(DEMO_NOTES); setLoading(false); return }
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
    setNotes(data ?? [])
    setLoading(false)
  }

  const totalNotes = notes.length
  const totalMinutes = totalNotes * MINUTES_PER_NOTE
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60

  const byHospital = HOSPITALS && Object.fromEntries(
    Object.entries(HOSPITALS).map(([key]) => [
      key,
      notes.filter((n) => n.hospital === key).length,
    ])
  ) as Record<Hospital, number>

  // Badge logic
  const earnedBadges = BADGES.filter((b) => totalNotes >= b.threshold)
  const nextBadge = BADGES.find((b) => totalNotes < b.threshold)
  const nextProgress = nextBadge
    ? Math.min(100, (totalNotes / nextBadge.threshold) * 100)
    : 100

  async function downloadHoursLetter() {
    setGeneratingPdf(true)
    try {
      const res = await fetch('/api/export/hours-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile?.name, notes: totalNotes, minutes: totalMinutes }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'fff-volunteer-hours.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error generating letter — please try again.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function shareImpact() {
    setGeneratingCard(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      if (!shareCardRef.current) return
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        backgroundColor: '#FDFAF6',
        useCORS: true,
      })
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'my-fff-impact.png'
        a.click()
        URL.revokeObjectURL(url)
      })
    } catch {
      alert('Error generating image — please try again.')
    } finally {
      setGeneratingCard(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-4xl animate-pulse-soft">🌸</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-cream-dark px-4 py-3 safe-top">
        <div className="max-w-lg mx-auto">
          <Logo size="sm" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

        {/* Hero card */}
        <div
          className="rounded-3xl p-6 animate-fade-in-up"
          style={{ background: 'linear-gradient(135deg, #E8637A 0%, #F9DDE0 100%)' }}
        >
          <p className="font-body text-white/90 text-base font-semibold mb-1">
            Hey {profile?.name?.split(' ')[0] ?? 'there'} 🌸
          </p>
          <p className="font-display text-6xl font-bold text-white mb-1">{totalNotes}</p>
          <p className="font-body text-white/90 text-base">
            {totalNotes === 1 ? 'note written' : 'notes written'}
          </p>
          <p className="font-body text-white/70 text-sm mt-1">
            = {totalHours > 0 ? `${totalHours}h ` : ''}{remainingMinutes}m volunteer time
          </p>
          <p className="font-body text-white/50 text-xs mt-2">
            1 note = {MINUTES_PER_NOTE} volunteer minutes
          </p>
        </div>

        {/* Hospital breakdown */}
        <div className="bg-white rounded-3xl border border-cream-dark p-5 animate-fade-in-up stagger-1">
          <p className="font-body text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-4">
            Notes by Hospital
          </p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(HOSPITALS).map(([key, label]) => (
              <div key={key} className="bg-cream rounded-2xl px-4 py-3">
                <p className="font-display text-2xl font-bold text-primary">{byHospital[key as Hospital] ?? 0}</p>
                <p className="font-body text-xs text-charcoal/60 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Badge shelf */}
        <div className="bg-white rounded-3xl border border-cream-dark p-5 animate-fade-in-up stagger-2">
          <p className="font-body text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-4">
            Badges
          </p>
          <div className="flex gap-3 flex-wrap">
            {BADGES.map((badge) => {
              const earned = totalNotes >= badge.threshold
              return (
                <div
                  key={badge.id}
                  className={`flex flex-col items-center px-4 py-3 rounded-2xl border transition-all ${
                    earned ? 'bg-blush border-primary/20' : 'bg-cream border-cream-dark opacity-40'
                  }`}
                >
                  <span className="text-2xl mb-1">{badge.icon}</span>
                  <p className="font-body text-xs font-bold text-charcoal text-center leading-tight">{badge.name}</p>
                  <p className="font-body text-xs text-charcoal/50 text-center mt-0.5 leading-tight">{badge.description}</p>
                </div>
              )
            })}
          </div>
          {nextBadge && (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-body text-charcoal/50 mb-1">
                <span>Next: {nextBadge.icon} {nextBadge.name}</span>
                <span>{totalNotes}/{nextBadge.threshold}</span>
              </div>
              <div className="h-1.5 bg-cream rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${nextProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Note history */}
        {notes.length > 0 && (
          <div className="bg-white rounded-3xl border border-cream-dark p-5 animate-fade-in-up stagger-3">
            <p className="font-body text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-4">
              Note History
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
              {notes.map((n) => (
                <div key={n.id} className="flex items-start gap-3 py-2 border-b border-cream-dark last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-body font-semibold text-primary">
                        {HOSPITALS[n.hospital]}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-body font-medium ${
                        n.status === 'printed' ? 'bg-sage/20 text-sage' : 'bg-blush text-primary'
                      }`}>
                        {n.status}
                      </span>
                    </div>
                    <p className="font-body text-sm text-charcoal/70 truncate">
                      {n.body.slice(0, 60)}…
                    </p>
                    <p className="font-body text-xs text-charcoal/40 mt-0.5">
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share card (hidden, used for screenshot) */}
        <div
          ref={shareCardRef}
          className="fixed -left-[9999px] top-0 w-80 p-8 bg-background flex flex-col items-center text-center"
          aria-hidden="true"
        >
          <Logo size="md" className="justify-center mb-4" />
          <p className="font-display text-5xl font-bold text-primary mb-2">{totalNotes}</p>
          <p className="font-body text-charcoal font-semibold text-lg mb-1">
            {profile?.name ?? 'A volunteer'} has written
          </p>
          <p className="font-body text-charcoal/70 text-base">
            {totalNotes === 1 ? 'note' : 'notes'} for Flowers for Fighters 🌸
          </p>
          <p className="font-body text-charcoal/50 text-sm mt-3">
            = {totalHours > 0 ? `${totalHours}h ` : ''}{remainingMinutes}m volunteer time
          </p>
          <p className="font-body text-xs text-charcoal/30 mt-4">flowersforfighters.base44.app</p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in-up stagger-4">
          <button
            onClick={shareImpact}
            disabled={generatingCard || totalNotes === 0}
            className="py-4 rounded-2xl bg-blush text-primary font-body font-bold text-sm border border-primary/20 disabled:opacity-40"
          >
            {generatingCard ? '...' : '📸 Share Impact'}
          </button>
          <button
            onClick={downloadHoursLetter}
            disabled={generatingPdf || totalNotes === 0}
            className="py-4 rounded-2xl bg-white text-charcoal font-body font-bold text-sm border border-cream-dark disabled:opacity-40"
          >
            {generatingPdf ? '...' : '📄 Hours Letter'}
          </button>
        </div>

        {totalNotes === 0 && (
          <div className="text-center py-8 animate-fade-in-up">
            <span className="text-4xl mb-3 block">🌱</span>
            <p className="font-body text-charcoal/60">
              Write your first note to start earning volunteer time!
            </p>
          </div>
        )}
      </div>

      <Navigation isAdmin={profile?.role === 'admin'} />
    </div>
  )
}
