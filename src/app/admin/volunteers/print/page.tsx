'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient, isDemoMode } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { VolunteerData } from '@/app/api/admin/volunteers-data/route'

export default function VolunteersPrintPage() {
  const [rows, setRows] = useState<VolunteerData[]>([])
  const [loading, setLoading] = useState(true)
  const [generatedAt] = useState(() => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
  const router = useRouter()
  const demoMode = isDemoMode()
  const supabase = createClient()

  useEffect(() => {
    if (demoMode) {
      setRows([
        { rank: 1, name: 'Emily R.', email: 'emily@example.com', location: 'Los Angeles, CA', school: 'Diamond Bar High School', role: 'supporter', notes: 25, noteMinutes: 375, referralMinutes: 30, totalMinutes: 405, totalHours: '6.75' },
        { rank: 2, name: 'Sarah M.', email: 'sarah@example.com', location: 'Diamond Bar, CA', school: 'Ayala High School', role: 'supporter', notes: 12, noteMinutes: 180, referralMinutes: 0, totalMinutes: 180, totalHours: '3.00' },
        { rank: 3, name: 'James K.', email: 'james@example.com', location: '', school: '', role: 'supporter', notes: 8, noteMinutes: 120, referralMinutes: 30, totalMinutes: 150, totalHours: '2.50' },
      ])
      setLoading(false)
      return
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || profile.role !== 'admin') { router.push('/'); return }

      const res = await fetch('/api/admin/volunteers-data')
      if (res.ok) {
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      }
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-print once loaded
  useEffect(() => {
    if (!loading && rows.length > 0) {
      const t = setTimeout(() => window.print(), 600)
      return () => clearTimeout(t)
    }
  }, [loading, rows])

  const totalVolunteers = rows.filter(r => r.notes > 0).length
  const totalNotes = rows.reduce((s, r) => s + r.notes, 0)
  const totalHours = (rows.reduce((s, r) => s + r.totalMinutes, 0) / 60).toFixed(1)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        Loading volunteer data…
      </div>
    )
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; color: #1a1a1a; }

        .page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }

        .header { margin-bottom: 24px; border-bottom: 2px solid #E8637A; padding-bottom: 16px; }
        .header h1 { font-size: 22px; font-weight: 700; color: #E8637A; font-family: 'Georgia', serif; }
        .header p { font-size: 12px; color: #888; margin-top: 4px; }

        .stats { display: flex; gap: 24px; margin-bottom: 24px; }
        .stat { background: #fdf6f7; border: 1px solid #f0dde0; border-radius: 8px; padding: 12px 20px; text-align: center; }
        .stat-num { font-size: 22px; font-weight: 700; color: #E8637A; }
        .stat-label { font-size: 11px; color: #888; margin-top: 2px; }

        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; padding: 8px 10px; background: #fdf6f7; border-bottom: 2px solid #f0dde0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; font-weight: 600; }
        th.center, td.center { text-align: center; }
        td { padding: 8px 10px; border-bottom: 1px solid #f5eded; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) td { background: #fdfafa; }

        .name { font-weight: 600; color: #1a1a1a; font-size: 12px; }
        .email { color: #888; font-size: 11px; margin-top: 1px; }
        .school { color: #7a9e7e; font-size: 11px; margin-top: 1px; }
        .hrs { font-weight: 700; color: #E8637A; }
        .rank { color: #bbb; font-size: 11px; }
        .bonus { color: #7a9e7e; font-weight: 600; }

        .footer { margin-top: 24px; font-size: 11px; color: #bbb; text-align: center; border-top: 1px solid #f0dde0; padding-top: 12px; }

        .no-print { margin-bottom: 20px; }
        @media print {
          .no-print { display: none; }
          .page { padding: 16px; max-width: 100%; }
          body { font-size: 11px; }
        }
      `}</style>

      <div className="page">
        {/* Print button — hidden when printing */}
        <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => window.print()}
            style={{ background: '#E8637A', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            🖨️ Print / Save as PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{ background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>

        <div className="header">
          <h1>Flowers for Fighters — Volunteer Hours</h1>
          <p>Generated {generatedAt} · {rows.length} volunteers · sorted by total hours</p>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-num">{totalVolunteers}</div>
            <div className="stat-label">Active volunteers</div>
          </div>
          <div className="stat">
            <div className="stat-num">{totalNotes}</div>
            <div className="stat-label">Notes written</div>
          </div>
          <div className="stat">
            <div className="stat-num">{totalHours}h</div>
            <div className="stat-label">Total hours</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th>Name / Email</th>
              <th>Location</th>
              <th>School</th>
              <th className="center">Notes</th>
              <th className="center">Bonus min</th>
              <th className="center">Total hrs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email || r.rank}>
                <td className="rank">{r.rank}</td>
                <td>
                  <div className="name">{r.name || '—'}</div>
                  <div className="email">{r.email}</div>
                </td>
                <td style={{ color: '#555', fontSize: 11 }}>{r.location || '—'}</td>
                <td>
                  {r.school ? <span className="school">{r.school}</span> : <span style={{ color: '#ccc' }}>—</span>}
                </td>
                <td className="center" style={{ fontWeight: 600 }}>{r.notes}</td>
                <td className="center">
                  {r.referralMinutes > 0 ? <span className="bonus">+{r.referralMinutes}</span> : <span style={{ color: '#ccc' }}>—</span>}
                </td>
                <td className="center hrs">{r.totalHours}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="footer">
          Flowers for Fighters · flowersforfighters.base44.app · All volunteer hours are earned at 15 min per note written
        </div>
      </div>
    </>
  )
}
