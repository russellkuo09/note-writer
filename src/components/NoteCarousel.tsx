'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { HOSPITALS } from '@/types'
import type { Hospital } from '@/types'

interface FeedNote {
  id: string
  body: string
  author_name: string
  hospital: Hospital
}

const FALLBACK: FeedNote[] = [
  {
    id: 'fallback',
    body: "Hey Fighter — a stranger from across the world is rooting for you today. You are so much stronger than you know. Keep going. 🌷",
    author_name: "Jamie",
    hospital: "shriners" as Hospital,
  },
]

function NoteCard({ note }: { note: FeedNote }) {
  const firstName = note.author_name?.split(' ')[0] ?? 'A Volunteer'
  const hospitalLabel = HOSPITALS[note.hospital] ?? note.hospital

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1.5px solid #F9DDE0',
        boxShadow: '0 8px 32px rgba(26,26,46,0.10), 0 2px 8px rgba(232,99,122,0.07)',
        padding: '22px 24px 18px 24px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Hospital label */}
      <p style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#aaa', marginBottom: 10, letterSpacing: 0.3 }}>
        For a Fighter at {hospitalLabel} 🌷
      </p>

      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 700, fontSize: 20, color: '#E8637A', lineHeight: 1.1, marginBottom: 4 }}>
          Notes for Fighters
        </div>
        <div style={{ width: '100%', height: 1, background: '#F9DDE0' }} />
      </div>

      {/* Note body */}
      <div style={{ flex: 1, padding: '10px 0 14px 0' }}>
        <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 13, lineHeight: 1.85, color: '#1A1A2E', margin: 0 }}>
          {note.body}
        </p>
      </div>

      {/* Signature */}
      <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontSize: 11, color: '#E8637A' }}>
        — {firstName}, Notes for Fighters Volunteer
      </div>
    </div>
  )
}

export default function NoteCarousel() {
  const [notes, setNotes] = useState<FeedNote[]>(FALLBACK)
  const [idx, setIdx] = useState(0)
  const [animated, setAnimated] = useState(true)
  const [cardsVisible, setCardsVisible] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Responsive: 3 on md+, 1 on mobile
  useEffect(() => {
    const update = () => setCardsVisible(window.innerWidth >= 768 ? 3 : 1)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Fetch live notes
  useEffect(() => {
    fetch('/api/public/notes')
      .then(r => r.json())
      .then(data => { if (data.notes?.length > 0) setNotes(data.notes) })
      .catch(() => {})
  }, [])

  // Cloned tail for seamless infinite loop
  const extNotes = useMemo(
    () => [...notes, ...notes.slice(0, Math.min(cardsVisible, notes.length))],
    [notes, cardsVisible]
  )

  const canScroll = notes.length > cardsVisible

  // Auto-advance
  useEffect(() => {
    if (!canScroll) return
    intervalRef.current = setInterval(() => setIdx(i => i + 1), 4000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [canScroll, notes.length])

  // Snap back when we reach the cloned tail
  useEffect(() => {
    if (idx >= notes.length) {
      const t = setTimeout(() => {
        setAnimated(false)
        setIdx(0)
        // Re-enable animation after the instant reset
        requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)))
      }, 500)
      return () => clearTimeout(t)
    }
  }, [idx, notes.length])

  const cardPct = 100 / cardsVisible

  return (
    <div className="px-0 pb-12 animate-fade-in-up">
      {/* Section header */}
      <div className="px-6 mb-6 text-center">
        <h2 className="font-display text-lg font-semibold text-charcoal">
          Notes written by real volunteers 🌷
        </h2>
        <p className="font-body text-sm text-charcoal/50 mt-1">
          Every one of these is on its way to a Fighter.
        </p>
      </div>

      {/* Carousel viewport */}
      <div style={{ overflow: 'hidden', paddingLeft: 24, paddingRight: 24 }}>
        <div
          style={{
            display: 'flex',
            transform: `translateX(${-(idx * cardPct)}%)`,
            transition: animated ? 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            gap: 16,
          }}
        >
          {extNotes.map((note, i) => (
            <div
              key={`${note.id}-${i}`}
              style={{
                flex: `0 0 calc(${cardPct}% - ${(cardsVisible - 1) * 16 / cardsVisible}px)`,
                minWidth: 0,
              }}
            >
              <NoteCard note={note} />
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {notes.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-5">
          {notes.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="transition-all"
              style={{
                width: (i % notes.length) === (idx % notes.length) ? 18 : 6,
                height: 6,
                borderRadius: 99,
                background: (i % notes.length) === (idx % notes.length) ? '#E8637A' : '#F9DDE0',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label={`Go to note ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
