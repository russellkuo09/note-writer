'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient, isDemoMode } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import Logo from '@/components/Logo'
import Navigation from '@/components/Navigation'
import AuthModal from '@/components/AuthModal'
import ConfettiEffect from '@/components/ConfettiEffect'
import { HOSPITALS, HOSPITAL_SLUGS, PATIENT_PROMPTS, MINUTES_PER_NOTE } from '@/types'
import type { Hospital, PatientPrompt } from '@/types'

const DRAFT_KEY = 'fff-note-draft'

const PLACEHOLDER =
  "Hey Fighter — I don't know your name, but I want you to know someone out here is rooting for you. You've got this. 🌸"

type AiState = 'idle' | 'loading' | 'done'

interface PolishedResult {
  original: string
  polished: string
}

export default function WritePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ name: string; role: string } | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [hospital, setHospital] = useState<Hospital | 'surprise'>('surprise')
  const [prompt, setPrompt] = useState<PatientPrompt | ''>('')
  const [note, setNote] = useState('')
  const [aiState, setAiState] = useState<AiState>('idle')
  const [aiAvailable, setAiAvailable] = useState(true)
  const [polished, setPolished] = useState<PolishedResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<{ hospital: string; minutes: number } | null>(null)
  const [noteCount, setNoteCount] = useState(0)
  const [noteCountTick, setNoteCountTick] = useState(false)
  const demoMode = isDemoMode()
  const supabase = createClient()
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auth state — in demo mode, auto-login as demo user
  useEffect(() => {
    if (demoMode) {
      setUser({ id: 'demo', email: 'demo@example.com' } as User)
      setProfile({ name: 'Demo', role: 'admin' })
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) fetchProfile(user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchProfile(userId: string) {
    if (demoMode) {
      setProfile({ name: 'Demo User', role: 'supporter' })
      return
    }
    const { data } = await supabase.from('profiles').select('name, role').eq('id', userId).single()
    if (data) setProfile(data)
  }

  // Note count
  useEffect(() => {
    if (!user || demoMode) return
    supabase
      .from('notes')
      .select('id', { count: 'exact' })
      .eq('author_id', user.id)
      .then(({ count }) => setNoteCount(count ?? 0))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Restore draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        const draft = JSON.parse(saved)
        if (draft.note) setNote(draft.note)
        if (draft.hospital) setHospital(draft.hospital)
        if (draft.prompt) setPrompt(draft.prompt)
      } catch {}
    }
  }, [])

  // Autosave draft
  const saveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ note, hospital, prompt }))
  }, [note, hospital, prompt])

  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(saveDraft, 5000)
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current)
    }
  }, [note, hospital, prompt, saveDraft])

  async function handlePolish() {
    if (!note.trim() || note.trim().length < 20) return
    setAiState('loading')
    setPolished(null)
    try {
      const res = await fetch('/api/ai/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, patientPrompt: prompt }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPolished({ original: note, polished: data.polished })
      setAiState('done')
    } catch {
      setAiAvailable(false)
      setAiState('idle')
    }
  }

  async function handleGenerateUnused() {
    setAiState('loading')
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientPrompt: prompt }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNote(data.generated)
      setAiState('idle')
    } catch {
      setAiAvailable(false)
      setAiState('idle')
    }
  }

  async function handleSubmit() {
    if (!user) { setShowAuth(true); return }
    if (!note.trim() || note.trim().length < 20) return

    setSubmitting(true)
    try {
      const finalHospital: Hospital =
        hospital === 'surprise'
          ? HOSPITAL_SLUGS[Math.floor(Math.random() * HOSPITAL_SLUGS.length)]
          : hospital

      if (!demoMode) {
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hospital: finalHospital,
            patient_prompt: prompt || null,
            body: note.trim(),
          }),
        })
      }

      // Clear draft
      localStorage.removeItem(DRAFT_KEY)

      const newCount = noteCount + 1
      setNoteCount(newCount)
      setNoteCountTick(true)
      setTimeout(() => setNoteCountTick(false), 400)

      setSubmitSuccess({
        hospital: HOSPITALS[finalHospital],
        minutes: MINUTES_PER_NOTE,
      })
      setShowConfetti(true)
      setNote('')
      setPolished(null)
      setHospital('surprise')
      setPrompt('')
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const charCount = note.length
  const charMin = 20
  const charMax = 500
  const charOk = charCount >= charMin && charCount <= charMax

  // ── Logged-out hero ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowAuth(false)}
          />
        )}

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
          <div className="animate-fade-in-up stagger-1">
            <Logo size="lg" className="justify-center mb-6" />
          </div>

          <h1 className="font-display text-4xl font-bold text-charcoal leading-tight mb-4 animate-fade-in-up stagger-2">
            Write a note.
            <br />
            <span className="text-primary">Brighten a Fighter&rsquo;s day.</span>
            <span className="ml-2">🌸</span>
          </h1>

          <p className="font-body text-charcoal/70 text-lg leading-relaxed max-w-sm mb-2 animate-fade-in-up stagger-3">
            Anyone, anywhere can write an encouragement note for a child in the hospital.
          </p>
          <p className="font-body text-charcoal/60 text-base leading-relaxed max-w-sm mb-10 animate-fade-in-up stagger-3">
            We print it and tuck it into a real flower bouquet — delivered by our team to
            pediatric patients at Shriners, Whittier, HealthBridge, and PVHMC.
          </p>

          {/* Stats pill */}
          <div className="flex items-center gap-3 px-5 py-3 bg-blush rounded-full mb-10 animate-fade-in-up stagger-4">
            <span className="text-xl">💐</span>
            <span className="font-body font-semibold text-primary text-sm">
              90+ bouquets delivered across 4 hospitals
            </span>
          </div>

          <button
            onClick={() => setShowAuth(true)}
            className="w-full max-w-xs py-4 rounded-2xl bg-primary text-white font-body font-bold text-lg transition-all active:scale-95 animate-fade-in-up stagger-5"
            style={{ boxShadow: '0 4px 24px rgba(232, 99, 122, 0.4)' }}
          >
            Start Writing 🌸
          </button>

          <p className="font-body text-xs text-charcoal/40 mt-4">
            Free • Takes 2 minutes • Earns volunteer hours
          </p>
        </div>

        {/* Footer */}
        <div className="pb-8 px-6 text-center">
          <p className="font-body text-xs text-charcoal/30">
            Diamond Bar, CA &nbsp;·&nbsp; Founded by Russell Kuo, age 16 &nbsp;·&nbsp; @flowersforfighters
          </p>
        </div>
      </div>
    )
  }

  // ── Logged-in note writer ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-32">
      <ConfettiEffect
        trigger={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />

      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-cream-dark px-4 py-3 safe-top">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <span className={`font-body text-sm font-bold text-primary transition-transform ${noteCountTick ? 'animate-tick scale-125' : ''}`}>
              {noteCount} {noteCount === 1 ? 'note' : 'notes'}
            </span>
            <button
              onClick={() => !demoMode && supabase.auth.signOut()}
              className="text-xs text-charcoal/40 font-body ml-2"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">

        {/* Success banner */}
        {submitSuccess && (
          <div className="bg-sage/10 border border-sage/30 rounded-2xl p-4 animate-fade-in-up">
            <p className="font-body font-semibold text-sage text-sm">
              Your note is queued for {submitSuccess.hospital}. You&apos;ve earned{' '}
              {submitSuccess.minutes} volunteer minutes. 🌸
            </p>
            <button
              onClick={() => setSubmitSuccess(null)}
              className="text-xs text-charcoal/40 mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Greeting */}
        <div className="animate-fade-in-up">
          <h2 className="font-display text-2xl font-semibold text-charcoal">
            Hey {profile?.name?.split(' ')[0] ?? 'there'} 🌸
          </h2>
          <p className="font-body text-charcoal/60 text-sm mt-1">
            Write something kind for a Fighter today.
          </p>
        </div>

        {/* Hospital selector */}
        <div className="animate-fade-in-up stagger-1">
          <p className="font-body text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-2">
            Which hospital?
          </p>
          <div className="flex flex-wrap gap-2">
            {([...HOSPITAL_SLUGS, 'surprise'] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHospital(h)}
                className={`px-3 py-1.5 rounded-full text-sm font-body font-semibold transition-all border ${
                  hospital === h
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-charcoal/70 border-cream-dark hover:border-primary/40'
                }`}
              >
                {h === 'surprise' ? 'Surprise Me 🌸' : HOSPITALS[h]}
              </button>
            ))}
          </div>
        </div>

        {/* Patient prompt */}
        <div className="animate-fade-in-up stagger-2">
          <p className="font-body text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-2">
            Who are you writing to? <span className="font-normal">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(PATIENT_PROMPTS) as [PatientPrompt, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPrompt(prompt === key ? '' : key)}
                className={`px-3 py-1.5 rounded-full text-sm font-body font-medium transition-all border ${
                  prompt === key
                    ? 'bg-blush text-primary border-primary/40'
                    : 'bg-white text-charcoal/60 border-cream-dark hover:border-blush'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Note text area */}
        <div className="animate-fade-in-up stagger-3">
          <div className="relative bg-white rounded-3xl border border-cream-dark overflow-hidden shadow-sm">
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value.slice(0, charMax))
                setPolished(null)
              }}
              placeholder={PLACEHOLDER}
              className="w-full min-h-48 px-5 pt-5 pb-12 font-body text-base text-charcoal placeholder:text-charcoal/30 bg-transparent focus:outline-none leading-relaxed"
              style={{ fontFamily: 'Nunito, sans-serif' }}
            />
            <div className="absolute bottom-3 right-4 flex items-center gap-3">
              <span
                className={`text-xs font-body ${
                  charCount < charMin
                    ? 'text-charcoal/30'
                    : charCount > charMax - 30
                    ? 'text-primary'
                    : 'text-charcoal/40'
                }`}
              >
                {charCount}/{charMax}
              </span>
            </div>
          </div>

          {charCount > 0 && charCount < charMin && (
            <p className="text-xs font-body text-charcoal/40 mt-1 ml-1">
              Add a few more words — {charMin - charCount} more to go
            </p>
          )}
        </div>

        {/* AI section */}
        {aiAvailable ? (
          <div className="animate-fade-in-up stagger-4 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handlePolish}
                disabled={aiState === 'loading' || note.trim().length < charMin}
                className={`flex-1 py-3 rounded-2xl font-body font-semibold text-sm transition-all border ${
                  aiState === 'loading'
                    ? 'shimmer text-white border-transparent'
                    : 'bg-white text-charcoal/80 border-cream-dark hover:border-primary/40 disabled:opacity-40'
                }`}
              >
                {aiState === 'loading' ? '✨ Polishing...' : '✨ Polish with AI'}
              </button>
            </div>

            {/* Before/after compare */}
            {polished && (
              <div className="bg-white rounded-3xl border border-cream-dark overflow-hidden animate-fade-in-up">
                <div className="p-4 border-b border-cream-dark">
                  <p className="text-xs font-body font-semibold text-charcoal/50 uppercase tracking-wide mb-2">Original</p>
                  <p className="font-body text-sm text-charcoal/70 leading-relaxed">{polished.original}</p>
                </div>
                <div className="p-4 bg-blush/20">
                  <p className="text-xs font-body font-semibold text-primary uppercase tracking-wide mb-2">✨ Polished</p>
                  <p className="font-body text-sm text-charcoal leading-relaxed">{polished.polished}</p>
                </div>
                <div className="flex gap-2 p-4 pt-0">
                  <button
                    onClick={() => setPolished(null)}
                    className="flex-1 py-2.5 rounded-xl font-body font-semibold text-sm text-charcoal/60 border border-cream-dark bg-white"
                  >
                    Keep Original
                  </button>
                  <button
                    onClick={() => { setNote(polished.polished); setPolished(null) }}
                    className="flex-1 py-2.5 rounded-xl font-body font-semibold text-sm text-white bg-primary"
                  >
                    Use Polished ✨
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm font-body text-charcoal/40 text-center py-2 animate-fade-in-up">
            AI polishing is temporarily unavailable — your note is perfect as-is 🌸
          </p>
        )}

        {/* Submit */}
        <div className="animate-fade-in-up stagger-5 pb-4">
          <button
            onClick={handleSubmit}
            disabled={submitting || !charOk}
            className="w-full py-4 rounded-2xl bg-primary text-white font-body font-bold text-lg transition-all active:scale-95 disabled:opacity-40"
            style={charOk ? { boxShadow: '0 4px 24px rgba(232, 99, 122, 0.35)' } : {}}
          >
            {submitting ? 'Sending...' : 'Send to a Fighter 🌸'}
          </button>
          {!user && (
            <p className="text-xs text-center font-body text-charcoal/40 mt-2">
              You&apos;ll sign in first — takes 30 seconds
            </p>
          )}
        </div>
      </div>

      <Navigation isAdmin={profile?.role === 'admin'} />
    </div>
  )
}
