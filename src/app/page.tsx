'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient, isDemoMode } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import Logo from '@/components/Logo'
// BrandText removed — duplicate on landing page was deleted
import Navigation from '@/components/Navigation'
import AuthModal from '@/components/AuthModal'
import ConfettiEffect from '@/components/ConfettiEffect'
import { HOSPITALS, HOSPITAL_SLUGS, PATIENT_PROMPTS, MINUTES_PER_NOTE } from '@/types'
import type { Hospital, PatientPrompt } from '@/types'

const DRAFT_KEY = 'fff-note-draft'
const REF_CODE_KEY = 'fff-ref-code'

const PLACEHOLDER =
  "Hey Fighter — I don't know your name, but I want you to know someone out here is rooting for you. You've got this. 🌸"

type AiState = 'idle' | 'loading' | 'done' | 'error'

interface PolishedResult {
  original: string
  polished: string
}

interface SubmitSuccess {
  hospital: string
  minutes: number
  new_streak: number
  dedication: string
}

export default function WritePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ name: string; role: string } | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [hospital, setHospital] = useState<Hospital | 'surprise'>('surprise')
  const [prompt, setPrompt] = useState<PatientPrompt | ''>('')
  const [note, setNote] = useState('')
  const [aiState, setAiState] = useState<AiState>('idle')
  const [polished, setPolished] = useState<PolishedResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<SubmitSuccess | null>(null)
  const [noteCount, setNoteCount] = useState(0)
  const [noteCountTick, setNoteCountTick] = useState(false)
  // Dedication
  const [dedicationEnabled, setDedicationEnabled] = useState(false)
  const [dedication, setDedication] = useState('')
  // Share card
  const [showShareCard, setShowShareCard] = useState(false)
  const [generatingShare, setGeneratingShare] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)
  const demoMode = isDemoMode()
  const supabase = createClient()
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Read ?ref= from URL and store in localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      localStorage.setItem(REF_CODE_KEY, ref)
    }
  }, [])

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
      if (session?.user) {
        fetchProfile(session.user.id)
        // Apply referral code on signup/login
        applyReferralCode(session.user.id)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function applyReferralCode(userId: string) {
    const refCode = localStorage.getItem(REF_CODE_KEY)
    if (!refCode) return
    try {
      await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref_code: refCode, new_user_id: userId }),
      })
      localStorage.removeItem(REF_CODE_KEY)
    } catch {
      // non-critical
    }
  }

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
    if (!note.trim() || note.trim().length < 50) return
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
      setAiState('error')
      setTimeout(() => setAiState('idle'), 4000)
    }
  }


  async function handleSubmit() {
    if (!user) { setShowAuth(true); return }
    if (!note.trim() || note.trim().length < 50) return

    setSubmitting(true)
    try {
      const finalHospital: Hospital =
        hospital === 'surprise'
          ? HOSPITAL_SLUGS[Math.floor(Math.random() * HOSPITAL_SLUGS.length)]
          : hospital

      let new_streak = 1
      if (!demoMode) {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hospital: finalHospital,
            patient_prompt: prompt || null,
            body: note.trim(),
            dedication: dedicationEnabled && dedication.trim() ? dedication.trim() : null,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          new_streak = data.new_streak ?? 1
        }
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
        new_streak,
        dedication: dedicationEnabled && dedication.trim() ? dedication.trim() : '',
      })
      setShowConfetti(true)
      setShowShareCard(true)
      setNote('')
      setPolished(null)
      setHospital('surprise')
      setPrompt('')
      setDedicationEnabled(false)
      setDedication('')
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownloadShareCard() {
    if (!shareCardRef.current) return
    setGeneratingShare(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
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
        a.download = 'my-note-for-fighters.png'
        a.click()
        URL.revokeObjectURL(url)
      })
    } catch {
      alert('Error generating image — please try again.')
    } finally {
      setGeneratingShare(false)
    }
  }

  async function handleCopyCaption() {
    const caption = "I just wrote a note for a pediatric patient fighter 🌸 Anyone can do it — write yours at notesforfighters.vercel.app #NotesForFighters #FlowersForFighters"
    try {
      await navigator.clipboard.writeText(caption)
      setCaptionCopied(true)
      setTimeout(() => setCaptionCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const charCount = note.length
  const charMin = 50
  const charMax = 300
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
            <Logo size="xl" showText={false} className="justify-center mb-6" />
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
            Free • Earn 15 volunteer minutes per note
          </p>
        </div>

        {/* ── How It Works ── */}
        <div className="px-6 pb-10 animate-fade-in-up">
          <h2 className="font-display text-base font-semibold text-charcoal/50 text-center uppercase tracking-widest mb-6">
            How it works
          </h2>
          <div className="flex items-start justify-between gap-2 max-w-sm mx-auto">
            {[
              { icon: '✏️', label: 'Write a note', sub: 'From anywhere in the world' },
              { icon: '🖨️', label: 'We print it', sub: 'On a card tucked into a bouquet' },
              { icon: '🌸', label: 'A Fighter receives it', sub: 'In a pediatric hospital room' },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-start gap-1 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <span className="text-2xl mb-2">{step.icon}</span>
                  <p className="font-body font-bold text-charcoal text-xs text-center leading-tight mb-1">{step.label}</p>
                  <p className="font-body text-charcoal/40 text-xs text-center leading-tight">{step.sub}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="text-charcoal/20 font-body text-lg mt-2 flex-shrink-0">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Example Card Preview ── */}
        <div className="px-6 pb-12 animate-fade-in-up">
          <h2 className="font-display text-base font-semibold text-charcoal/50 text-center uppercase tracking-widest mb-5">
            What your note looks like 🌸
          </h2>

          {/* Card preview — mirrors the real printed card styling */}
          <div
            className="relative mx-auto max-w-xs rounded-xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 8px 32px rgba(26,26,46,0.13), 0 1.5px 6px rgba(232,99,122,0.08)', border: '1.5px solid #F9DDE0' }}
          >
            {/* EXAMPLE watermark */}
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', pointerEvents: 'none', zIndex: 10,
                transform: 'rotate(-32deg)',
                fontFamily: '"Playfair Display", Georgia, serif',
                fontStyle: 'italic', fontSize: 44, fontWeight: 700,
                color: 'rgba(26,26,46,0.055)', letterSpacing: 6, userSelect: 'none',
              }}
            >
              EXAMPLE
            </div>

            <div style={{ padding: '28px 28px 22px 28px' }}>
              {/* Header */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 700, fontSize: 26, color: '#E8637A', lineHeight: 1.1, marginBottom: 3 }}>
                  Notes for Fighters
                </div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontSize: 11, color: '#aaaaaa', marginBottom: 10 }}>
                  A note for you, Fighter 🌸
                </div>
                <div style={{ width: '100%', height: 1, background: '#F9DDE0' }} />
              </div>

              {/* Note body */}
              <div style={{ padding: '14px 0 18px 0' }}>
                <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 13, lineHeight: 1.85, color: '#1A1A2E' }}>
                  Hey Fighter — a stranger from across the world is rooting for you today. You are so much stronger than you know. Keep going. 🌸
                </p>
              </div>

              {/* Footer row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontSize: 11, color: '#E8637A', marginBottom: 3 }}>
                    — Jamie, Notes for Fighters Volunteer
                  </div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 9, color: '#cccccc' }}>
                    notesforfighters.vercel.app
                  </div>
                </div>
                {/* Tiny QR placeholder */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: 46, height: 46, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                      <rect x="2" y="2" width="14" height="14" rx="1.5" fill="#1A1A2E" opacity=".15"/>
                      <rect x="5" y="5" width="8" height="8" rx=".5" fill="#1A1A2E" opacity=".3"/>
                      <rect x="20" y="2" width="14" height="14" rx="1.5" fill="#1A1A2E" opacity=".15"/>
                      <rect x="23" y="5" width="8" height="8" rx=".5" fill="#1A1A2E" opacity=".3"/>
                      <rect x="2" y="20" width="14" height="14" rx="1.5" fill="#1A1A2E" opacity=".15"/>
                      <rect x="5" y="23" width="8" height="8" rx=".5" fill="#1A1A2E" opacity=".3"/>
                      <rect x="20" y="20" width="4" height="4" rx=".5" fill="#1A1A2E" opacity=".2"/>
                      <rect x="26" y="20" width="4" height="4" rx=".5" fill="#1A1A2E" opacity=".2"/>
                      <rect x="20" y="26" width="4" height="4" rx=".5" fill="#1A1A2E" opacity=".2"/>
                      <rect x="30" y="26" width="4" height="4" rx=".5" fill="#1A1A2E" opacity=".2"/>
                      <rect x="30" y="20" width="4" height="4" rx=".5" fill="#1A1A2E" opacity=".2"/>
                      <rect x="26" y="30" width="4" height="4" rx=".5" fill="#1A1A2E" opacity=".2"/>
                    </svg>
                  </div>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 8, color: '#aaa' }}>Scan me 🌸</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pb-8 px-6 text-center">
          <p className="font-body text-xs text-charcoal/30">
            Diamond Bar, CA &nbsp;·&nbsp; @fff.initiative
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
              {submitSuccess.dedication
                ? `Your note — dedicated to ${submitSuccess.dedication} — is on its way to a Fighter. 🌸`
                : `Your note is queued for ${submitSuccess.hospital}. You've earned ${submitSuccess.minutes} volunteer minutes. 🌸`}
            </p>
            {/* Streak message */}
            <p className="font-body text-sm text-charcoal/70 mt-1">
              {submitSuccess.new_streak > 1
                ? `🔥 ${submitSuccess.new_streak} day streak! Come back tomorrow to keep it going.`
                : '🌸 Day 1 — come back tomorrow to start a streak!'}
            </p>
            <p className="font-body text-xs text-charcoal/50 italic mt-1">
              Signed as: — {profile?.name?.split(' ')[0] ?? 'You'}, Notes for Fighters Volunteer
            </p>
            <button
              onClick={() => { setSubmitSuccess(null); setShowShareCard(false) }}
              className="text-xs text-charcoal/40 mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Share your note card */}
        {showShareCard && submitSuccess && (
          <div className="bg-white border border-cream-dark rounded-2xl p-4 animate-fade-in-up">
            <p className="font-body font-semibold text-charcoal text-sm mb-3">Share Your Note 🌸</p>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadShareCard}
                disabled={generatingShare}
                className="flex-1 py-2.5 rounded-xl font-body font-semibold text-sm bg-blush text-primary border border-primary/20 disabled:opacity-40"
              >
                {generatingShare ? '...' : '⬇️ Download Image'}
              </button>
              <button
                onClick={handleCopyCaption}
                className="flex-1 py-2.5 rounded-xl font-body font-semibold text-sm bg-white text-charcoal border border-cream-dark"
              >
                {captionCopied ? '✓ Copied!' : '📋 Copy Caption'}
              </button>
            </div>
          </div>
        )}

        {/* Hidden share card for html2canvas */}
        <div
          ref={shareCardRef}
          className="fixed"
          style={{ left: '-9999px', top: 0, width: '400px', height: '400px', background: '#FDFAF6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', position: 'fixed' }}
          aria-hidden="true"
        >
          {/* Corner flowers */}
          <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 28 }}>🌸</span>
          <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 28 }}>🌸</span>
          <span style={{ position: 'absolute', bottom: 48, left: 12, fontSize: 28 }}>🌸</span>
          <span style={{ position: 'absolute', bottom: 48, right: 12, fontSize: 28 }}>🌸</span>
          {/* Header */}
          <div style={{ paddingTop: 24, textAlign: 'center' }}>
            <p style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 700, color: '#E8637A', lineHeight: 1 }}>
              <span style={{ fontSize: 28 }}>N</span><span style={{ fontSize: 16 }}>otes</span>
              {' '}<span style={{ fontSize: 20 }}>f</span><span style={{ fontSize: 16 }}>or</span>
              {' '}<span style={{ fontSize: 28 }}>F</span><span style={{ fontSize: 16 }}>ighters</span>
            </p>
          </div>
          {/* Blurred note body */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 32px' }}>
            <p style={{ fontFamily: 'Playfair Display, Georgia, serif', fontStyle: 'italic', fontSize: 15, color: '#1A1A2E', textAlign: 'center', lineHeight: 1.6, filter: 'blur(3px)', userSelect: 'none' }}>
              {submitSuccess?.hospital ? `A heartfelt note for a fighter at ${submitSuccess.hospital}` : 'A heartfelt note for a fighter'}
            </p>
          </div>
          {/* Signature */}
          <div style={{ textAlign: 'center', paddingBottom: 8 }}>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#7BAE8A' }}>
              — {profile?.name?.split(' ')[0] ?? 'A volunteer'}, Notes for Fighters Volunteer
            </p>
          </div>
          {/* Bottom strip */}
          <div style={{ width: '100%', background: '#E8637A', padding: '10px 0', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: 'white' }}>notesforfighters.vercel.app</p>
          </div>
        </div>

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

        {/* Dedication toggle */}
        <div className="animate-fade-in-up stagger-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDedicationEnabled(!dedicationEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dedicationEnabled ? 'bg-primary' : 'bg-cream-dark'}`}
              role="switch"
              aria-checked={dedicationEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dedicationEnabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
            <span className="font-body text-sm text-charcoal/70">Dedicate this note <span className="text-charcoal/40">(optional)</span></span>
          </div>
          {dedicationEnabled && (
            <div className="mt-2">
              <input
                type="text"
                value={dedication}
                onChange={(e) => setDedication(e.target.value.slice(0, 60))}
                placeholder="e.g. my little sister Emma, my grandpa who fought cancer"
                maxLength={60}
                className="w-full px-4 py-2.5 rounded-xl border border-cream-dark bg-white font-body text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:border-primary/40"
              />
              <p className="text-xs text-charcoal/40 mt-1 text-right">{dedication.length}/60</p>
            </div>
          )}
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

          {/* Signature preview */}
          {charCount >= charMin && (
            <p className="text-xs font-body text-charcoal/40 mt-2 ml-1 italic animate-fade-in-up">
              — {profile?.name?.split(' ')[0] ?? 'You'}, Notes for Fighters Volunteer
            </p>
          )}

          {/* Print tip */}
          <p className="text-xs font-body text-charcoal/30 mt-1 ml-1">
            Shorter notes print better on cards 🌸
          </p>
        </div>

        {/* AI section */}
        {(
          <div className="animate-fade-in-up stagger-4 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handlePolish}
                disabled={aiState === 'loading' || aiState === 'error' || note.trim().length < charMin}
                className={`flex-1 py-3 rounded-2xl font-body font-semibold text-sm transition-all border ${
                  aiState === 'loading'
                    ? 'shimmer text-white border-transparent'
                    : aiState === 'error'
                    ? 'bg-white text-red-400 border-red-200'
                    : 'bg-white text-charcoal/80 border-cream-dark hover:border-primary/40 disabled:opacity-40'
                }`}
              >
                {aiState === 'loading' ? '✨ Polishing...' : aiState === 'error' ? '⚠️ Try again in a moment' : '✨ Polish with AI'}
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
