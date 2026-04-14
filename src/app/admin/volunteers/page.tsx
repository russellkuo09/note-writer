'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient, isDemoMode } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Logo from '@/components/Logo'

interface VolunteerRow {
  rank: number
  name: string
  email: string
  location: string
  school: string
  role: string
  notes: number
  noteMinutes: number
  referralMinutes: number
  totalMinutes: number
  totalHours: string
}

const DEMO_ROWS: VolunteerRow[] = [
  { rank: 1, name: 'Emily R.', email: 'emily@example.com', location: 'Los Angeles, CA', school: 'Diamond Bar High School', role: 'supporter', notes: 25, noteMinutes: 375, referralMinutes: 30, totalMinutes: 405, totalHours: '6.75' },
  { rank: 2, name: 'Sarah M.', email: 'sarah@example.com', location: 'Diamond Bar, CA', school: 'Ayala High School', role: 'supporter', notes: 12, noteMinutes: 180, referralMinutes: 0, totalMinutes: 180, totalHours: '3.00' },
  { rank: 3, name: 'James K.', email: 'james@example.com', location: '', school: '', role: 'supporter', notes: 8, noteMinutes: 120, referralMinutes: 30, totalMinutes: 150, totalHours: '2.50' },
]

export default function VolunteersPage() {
  const [rows, setRows] = useState<VolunteerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const demoMode = isDemoMode()
  const supabase = createClient()

  useEffect(() => {
    if (demoMode) {
      setRows(DEMO_ROWS)
      setLoading(false)
      return
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || profile.role !== 'admin') { setUnauthorized(true); setLoading(false); return }

      const res = await fetch('/api/export/csv')
      if (!res.ok) { setLoading(false); return }
      const text = await res.text()
      const lines = text.trim().split('\n')
      const parsed: VolunteerRow[] = lines.slice(1).map((line) => {
        // Parse CSV respecting quoted fields
        const cols: string[] = []
        let cur = '', inQ = false
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') { inQ = !inQ }
          else if (line[i] === ',' && !inQ) { cols.push(cur); cur = '' }
          else { cur += line[i] }
        }
        cols.push(cur)
        return {
          rank: parseInt(cols[0]) || 0,
          name: cols[1] ?? '',
          email: cols[2] ?? '',
          location: cols[3] ?? '',
          school: cols[4] ?? '',
          role: cols[5] ?? '',
          notes: parseInt(cols[6]) || 0,
          noteMinutes: parseInt(cols[7]) || 0,
          referralMinutes: parseInt(cols[8]) || 0,
          totalMinutes: parseInt(cols[9]) || 0,
          totalHours: cols[10] ?? '0.00',
        }
      })
      setRows(parsed)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function downloadCsv() {
    fetch('/api/export/csv').then(async res => {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fff-volunteer-hours-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const filtered = rows.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase()) ||
    r.location.toLowerCase().includes(search.toLowerCase()) ||
    r.school.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-4xl animate-pulse-soft">📊</span>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-4">🔒</span>
        <h2 className="font-display text-2xl font-semibold text-charcoal mb-2">Admin only</h2>
        <button onClick={() => router.push('/')} className="text-primary font-body font-semibold">← Back</button>
      </div>
    )
  }

  const totalVolunteers = rows.filter(r => r.notes > 0).length
  const totalHours = (rows.reduce((s, r) => s + r.totalMinutes, 0) / 60).toFixed(1)
  const totalNotes = rows.reduce((s, r) => s + r.notes, 0)

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-cream-dark px-4 py-3 safe-top">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin')} className="text-charcoal/50 font-body text-sm">← Admin</button>
            <Logo size="sm" />
          </div>
          <span className="font-body text-xs text-charcoal/50 bg-sage/20 text-sage px-2 py-1 rounded-full font-semibold">
            Volunteer Hours
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-5 space-y-5">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in-up">
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-primary">{totalVolunteers}</p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">Active volunteers</p>
          </div>
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-charcoal">{totalNotes}</p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">Notes written</p>
          </div>
          <div className="bg-white rounded-2xl border border-cream-dark p-4 text-center">
            <p className="font-display text-2xl font-bold text-sage">{totalHours}h</p>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">Total hours</p>
          </div>
        </div>

        {/* Search + Download */}
        <div className="flex gap-2 animate-fade-in-up stagger-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or location…"
            className="flex-1 border border-cream-dark rounded-2xl px-4 py-2.5 font-body text-sm text-charcoal focus:outline-none focus:border-primary bg-white"
          />
          <button
            onClick={downloadCsv}
            className="px-4 py-2.5 rounded-2xl font-body font-semibold text-sm text-white bg-primary shrink-0"
            style={{ boxShadow: '0 2px 8px rgba(232,99,122,0.25)' }}
          >
            ↓ CSV
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden animate-fade-in-up stagger-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-cream-dark bg-cream/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wide hidden sm:table-cell">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wide hidden md:table-cell">School</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Notes</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wide hidden sm:table-cell">Bonus min</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Total hrs</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-charcoal/40 font-body text-sm">No results</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r.email} className="border-b border-cream-dark last:border-0 hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3 text-charcoal/40 text-xs">{r.rank}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-charcoal text-sm">{r.name || '—'}</p>
                      <p className="text-charcoal/40 text-xs">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-charcoal/50 text-xs hidden sm:table-cell">{r.location || '—'}</td>
                    <td className="px-4 py-3 text-charcoal/50 text-xs hidden md:table-cell">{r.school || '—'}</td>
                    <td className="px-4 py-3 text-center font-semibold text-charcoal">{r.notes}</td>
                    <td className="px-4 py-3 text-center text-charcoal/50 hidden sm:table-cell">
                      {r.referralMinutes > 0 ? <span className="text-sage font-semibold">+{r.referralMinutes}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${parseFloat(r.totalHours) > 0 ? 'text-primary' : 'text-charcoal/30'}`}>
                        {r.totalHours}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="font-body text-xs text-charcoal/30 text-center animate-fade-in-up stagger-3">
          {filtered.length} of {rows.length} volunteers · sorted by total hours
        </p>
      </div>

      <Navigation isAdmin />
    </div>
  )
}
