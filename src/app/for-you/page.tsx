'use client'

import { useState, useEffect } from 'react'

interface Stats {
  total_notes: number
  fighters_reached: number
}

export default function ForYouPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => r.json())
      .then((data: Stats) => setStats(data))
      .catch(() => {})
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FDFAF6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'Nunito, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, padding: '0 24px', paddingBottom: 60 }}>

        {/* Hero section */}
        <div
          className="animate-fade-in-up"
          style={{
            background: 'linear-gradient(160deg, #F9DDE0 0%, #FDFAF6 70%)',
            borderRadius: '0 0 32px 32px',
            padding: '60px 32px 48px',
            textAlign: 'center',
            marginBottom: 28,
            marginLeft: -24,
            marginRight: -24,
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }}>🌸</div>
          <h1
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 32,
              fontWeight: 700,
              color: '#1A1A2E',
              lineHeight: 1.3,
              marginBottom: 16,
            }}
          >
            This note was written<br />just for you.
          </h1>
          <p
            style={{
              fontSize: 17,
              color: '#1A1A2E99',
              lineHeight: 1.7,
              maxWidth: 340,
              margin: '0 auto',
            }}
          >
            A caring stranger took a few minutes out of their day to write you an encouragement note.
            They don&apos;t know your name — but they wanted you to know someone on the outside is thinking of you.
          </p>
        </div>

        {/* Mission card */}
        <div
          className="animate-fade-in-up"
          style={{
            background: 'white',
            borderRadius: 24,
            border: '1px solid #F5EFE6',
            padding: '28px 24px',
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: '#E8637A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            About This Note
          </p>
          <p style={{ fontSize: 16, color: '#1A1A2E', lineHeight: 1.7, marginBottom: 12 }}>
            <strong>Notes for Fighters</strong> is a program by Flowers for Fighters — a nonprofit started by a 16-year-old in Diamond Bar, California.
          </p>
          <p style={{ fontSize: 15, color: '#1A1A2ECC', lineHeight: 1.7 }}>
            Volunteers from all over write encouragement notes online. We print them and tuck them into real flower bouquets — delivered by our team to pediatric patients like you at hospitals across Southern California.
          </p>
          <p style={{ fontSize: 15, color: '#1A1A2ECC', lineHeight: 1.7, marginTop: 12 }}>
            This note came with flowers. Because every Fighter deserves to feel seen. 💐
          </p>
        </div>

        {/* Live stats */}
        <div
          className="animate-fade-in-up"
          style={{
            background: 'linear-gradient(135deg, #E8637A 0%, #F9DDE0 100%)',
            borderRadius: 24,
            padding: '28px 24px',
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Notes Written So Far
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
            <div>
              <p style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 48, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>
                {stats ? stats.total_notes : '—'}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Notes Written</p>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
            <div>
              <p style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 48, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>
                {stats ? stats.fighters_reached : '—'}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Fighters Reached</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 16 }}>
            Every one of those notes was written for a real person — just like you.
          </p>
        </div>

        {/* Message of hope */}
        <div
          className="animate-fade-in-up"
          style={{
            background: '#F9DDE0',
            borderRadius: 24,
            padding: '28px 24px',
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          <p style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20, fontStyle: 'italic', color: '#1A1A2E', lineHeight: 1.6 }}>
            &ldquo;Keep fighting. You are braver than you know, and stronger than you feel. We are rooting for you.&rdquo;
          </p>
          <p style={{ fontSize: 13, color: '#E8637A', fontWeight: 600, marginTop: 12 }}>
            — Flowers for Fighters Volunteers 🌸
          </p>
        </div>

        {/* CTA */}
        <div className="animate-fade-in-up" style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 15, color: '#1A1A2E99', marginBottom: 20, lineHeight: 1.6 }}>
            Know someone who could use a note of encouragement?<br />
            Anyone can write a note — it takes just 2 minutes.
          </p>
          <a
            href="https://notesforfighters.vercel.app"
            style={{
              display: 'inline-block',
              background: '#E8637A',
              color: 'white',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              fontSize: 17,
              padding: '16px 40px',
              borderRadius: 16,
              textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(232, 99, 122, 0.35)',
            }}
          >
            Write a Note for a Fighter 🌸
          </a>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingBottom: 24 }}>
          <p style={{ fontSize: 13, color: '#1A1A2E40', lineHeight: 1.8 }}>
            Flowers for Fighters &nbsp;·&nbsp; Diamond Bar, CA
            <br />
            @fff.initiative &nbsp;·&nbsp; notesforfighters.vercel.app
          </p>
        </div>
      </div>
    </div>
  )
}
