'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts'
import type { ActivityUser } from '@/app/api/admin/activity/route'

// ── Palette — up to 12 distinct colours ────────────────────────────────────
const COLORS = [
  '#E8637A', '#6DBB9A', '#F4A261', '#4ECDC4', '#A78BFA',
  '#FB923C', '#38BDF8', '#F472B6', '#34D399', '#FBBF24',
  '#60A5FA', '#A3E635',
]

// ── Helper: build array of 'YYYY-MM-DD' between two dates ─────────────────
function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const cur = new Date(from + 'T12:00:00Z')
  const end = new Date(to + 'T12:00:00Z')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function fmtDate(d: string) {
  const [, m, day] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(day)}`
}

function daysAgoDate(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ── Sort key type ─────────────────────────────────────────────────────────
type SortKey = 'rank' | 'name' | 'school' | 'thisMonth' | 'allTime' | 'lastActive'

interface Props {
  /** If provided, locks the school and hides school filter */
  lockedSchool?: string
  /** Title shown above the graph */
  title?: string
  /** true = admin context (can filter by school), false = chapter lead */
  isAdmin?: boolean
}

interface ChartPoint {
  date: string
  label: string
  [userId: string]: string | number
}

// ── Custom tooltip ────────────────────────────────────────────────────────
interface TooltipPayloadItem {
  dataKey: string
  value: number
  payload: ChartPoint
}

function CustomTooltip({
  active,
  payload,
  users,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  users: ActivityUser[]
}) {
  if (!active || !payload?.length) return null
  const items = payload.filter(p => p.value > 0)
  if (!items.length) return null

  return (
    <div className="bg-white border border-cream-dark rounded-2xl shadow-xl px-4 py-3 text-left min-w-[160px]">
      <p className="font-body text-xs text-charcoal/50 mb-2">{fmtDate(items[0].payload.date)}</p>
      {items.map((item) => {
        const u = users.find(u => u.authorId === item.dataKey)
        return (
          <div key={item.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="font-body text-sm font-semibold text-charcoal">{u?.firstName ?? item.dataKey}</span>
            {u?.school && <span className="font-body text-xs text-charcoal/40 truncate max-w-[100px]">{u.school}</span>}
            <span className="font-body text-sm font-bold text-primary ml-auto">{item.value}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function NoteActivityGraph({ lockedSchool, title, isAdmin = false }: Props) {
  const [users, setUsers] = useState<ActivityUser[]>([])
  const [schools, setSchools] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Filters
  const [schoolFilter, setSchoolFilter] = useState<string>('all')
  const [rangeDays, setRangeDays] = useState(30)

  // Table sort
  const [sortKey, setSortKey] = useState<SortKey>('allTime')
  const [sortAsc, setSortAsc] = useState(false)

  const fromDate = daysAgoDate(rangeDays - 1)
  const toDate = new Date().toISOString().slice(0, 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate })
      if (lockedSchool) params.set('school', lockedSchool)
      else if (schoolFilter !== 'all') params.set('school', schoolFilter)
      const res = await fetch(`/api/admin/activity?${params}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setUsers(data.users ?? [])
      setSchools(data.schools ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, lockedSchool, schoolFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Build chart data: one row per day, columns per user ─────────────────
  const dates = useMemo(() => dateRange(fromDate, toDate), [fromDate, toDate])

  const chartData: ChartPoint[] = useMemo(() => {
    return dates.map(date => {
      const point: ChartPoint = { date, label: fmtDate(date) }
      for (const u of users) {
        point[u.authorId] = u.dailyCounts[date] ?? 0
      }
      return point
    })
  }, [dates, users])

  // Only render bars for users who wrote at least 1 note in the date window
  const activeUsers = useMemo(() =>
    users.filter(u => Object.values(u.dailyCounts).some(v => v > 0)),
    [users]
  )

  // ── Sorted table ─────────────────────────────────────────────────────────
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortKey) {
        case 'name':       va = a.name; vb = b.name; break
        case 'school':     va = a.school ?? ''; vb = b.school ?? ''; break
        case 'thisMonth':  va = a.thisMonthNotes; vb = b.thisMonthNotes; break
        case 'lastActive': va = a.lastActive ?? ''; vb = b.lastActive ?? ''; break
        case 'allTime':
        default:           va = a.totalNotes; vb = b.totalNotes; break
      }
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [users, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-charcoal/20 ml-0.5">↕</span>
    return <span className="text-primary ml-0.5">{sortAsc ? '↑' : '↓'}</span>
  }

  const graphTitle = title ?? (lockedSchool ? `${lockedSchool} Note Activity` : 'Note Activity')

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header + filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="font-body text-sm font-semibold text-charcoal">{graphTitle}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {/* School filter — admin only, not locked */}
            {isAdmin && !lockedSchool && schools.length > 0 && (
              <select
                value={schoolFilter}
                onChange={e => setSchoolFilter(e.target.value)}
                className="text-xs font-body px-3 py-1.5 rounded-xl border border-cream-dark bg-white text-charcoal/70 focus:outline-none focus:border-primary/40"
              >
                <option value="all">All Schools</option>
                {schools.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            {/* Date range */}
            <select
              value={rangeDays}
              onChange={e => setRangeDays(Number(e.target.value))}
              className="text-xs font-body px-3 py-1.5 rounded-xl border border-cream-dark bg-white text-charcoal/70 focus:outline-none focus:border-primary/40"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-cream-dark p-4">
        {loading ? (
          <div className="h-52 flex items-center justify-center">
            <span className="text-3xl animate-pulse-soft">🌷</span>
          </div>
        ) : error ? (
          <div className="h-52 flex items-center justify-center">
            <p className="font-body text-sm text-charcoal/40">Could not load activity data</p>
          </div>
        ) : activeUsers.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">🌱</span>
            <p className="font-body text-sm text-charcoal/40">No notes written in this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE2" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fontFamily: 'inherit', fill: '#9e8e7e' }}
                interval={Math.max(0, Math.floor(dates.length / 6) - 1)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fontFamily: 'inherit', fill: '#9e8e7e' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip users={users} />}
                cursor={{ fill: '#F9DDE0', opacity: 0.5 }}
              />
              {activeUsers.length <= 10 && (
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => {
                    const u = users.find(u => u.authorId === value)
                    return <span style={{ fontSize: 11, fontFamily: 'inherit', color: '#5a4a3a' }}>{u?.firstName ?? value}</span>
                  }}
                  wrapperStyle={{ paddingTop: 8 }}
                />
              )}
              {activeUsers.map((u, i) => (
                <Bar
                  key={u.authorId}
                  dataKey={u.authorId}
                  name={u.authorId}
                  stackId="a"
                  fill={COLORS[i % COLORS.length]}
                  radius={i === activeUsers.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={32}
                >
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sortable table */}
      {!loading && sortedUsers.length > 0 && (
        <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-cream-dark bg-cream/50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide w-10">#</th>
                  <th
                    className="text-left px-3 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide cursor-pointer hover:text-charcoal/80 select-none"
                    onClick={() => toggleSort('name')}
                  >
                    Name <SortIcon k="name" />
                  </th>
                  {!lockedSchool && (
                    <th
                      className="text-left px-3 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide cursor-pointer hover:text-charcoal/80 select-none"
                      onClick={() => toggleSort('school')}
                    >
                      School <SortIcon k="school" />
                    </th>
                  )}
                  <th
                    className="text-center px-3 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide cursor-pointer hover:text-charcoal/80 select-none"
                    onClick={() => toggleSort('thisMonth')}
                  >
                    This month <SortIcon k="thisMonth" />
                  </th>
                  <th
                    className="text-center px-3 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide cursor-pointer hover:text-charcoal/80 select-none"
                    onClick={() => toggleSort('allTime')}
                  >
                    All time <SortIcon k="allTime" />
                  </th>
                  <th
                    className="text-center px-3 py-2.5 text-xs font-semibold text-charcoal/50 uppercase tracking-wide cursor-pointer hover:text-charcoal/80 select-none"
                    onClick={() => toggleSort('lastActive')}
                  >
                    Last active <SortIcon k="lastActive" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u, i) => (
                  <tr key={u.authorId} className="border-b border-cream-dark last:border-0 hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3 text-charcoal/40 text-xs font-semibold">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: COLORS[users.findIndex(uu => uu.authorId === u.authorId) % COLORS.length] }}
                        >
                          {u.firstName[0]?.toUpperCase()}
                        </span>
                        <span className="font-semibold text-charcoal">{u.name}</span>
                      </div>
                    </td>
                    {!lockedSchool && (
                      <td className="px-3 py-3 text-charcoal/60 text-xs">{u.school ?? <span className="text-charcoal/30">—</span>}</td>
                    )}
                    <td className="px-3 py-3 text-center font-semibold text-charcoal/70">{u.thisMonthNotes || <span className="text-charcoal/30">—</span>}</td>
                    <td className="px-3 py-3 text-center font-bold text-primary">{u.totalNotes}</td>
                    <td className="px-3 py-3 text-center text-xs text-charcoal/50">
                      {u.lastActive
                        ? new Date(u.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : <span className="text-charcoal/30">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
