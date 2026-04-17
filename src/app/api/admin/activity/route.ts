import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase-server'

export interface ActivityRow {
  authorId: string
  name: string
  firstName: string
  school: string | null
  date: string        // 'YYYY-MM-DD'
  count: number
}

export interface ActivityUser {
  authorId: string
  name: string
  firstName: string
  school: string | null
  totalNotes: number
  thisMonthNotes: number
  lastActive: string | null
  dailyCounts: Record<string, number>  // date → count
}

export interface ActivityResponse {
  users: ActivityUser[]
  schools: string[]   // sorted unique school names
  dateRange: { from: string; to: string }
}

export async function GET(req: NextRequest) {
  // Auth — admin or chapter_lead
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, school')
    .eq('id', user.id)
    .single()

  const isAdmin = callerProfile?.role === 'admin'
  const isChapterLead = callerProfile?.role === 'chapter_lead'
  if (!isAdmin && !isChapterLead) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const params = req.nextUrl.searchParams

  // Date range — default last 30 days
  const toDate = params.get('to') ?? new Date().toISOString().slice(0, 10)
  const fromDate = params.get('from') ?? (() => {
    const d = new Date(toDate)
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })()

  // School filter — admins can pass ?school=, chapter leads locked to theirs
  const schoolFilter = isChapterLead
    ? (callerProfile?.school ?? null)
    : (params.get('school') ?? null)

  // 1. Fetch profiles (with school)
  let profileQuery = svc.from('profiles').select('id, name, school')
  if (schoolFilter) profileQuery = profileQuery.eq('school', schoolFilter)
  const { data: profiles } = await profileQuery

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ users: [], schools: [], dateRange: { from: fromDate, to: toDate } })
  }

  const profileMap: Record<string, { name: string; school: string | null }> = {}
  for (const p of profiles) {
    profileMap[p.id] = { name: p.name ?? 'Unknown', school: p.school ?? null }
  }

  const memberIds = profiles.map(p => p.id)

  // 2. Fetch notes within date range for those members
  const { data: notes } = await svc
    .from('notes')
    .select('author_id, created_at, status')
    .in('author_id', memberIds)
    .in('status', ['queued', 'printed'])
    .gte('created_at', `${fromDate}T00:00:00.000Z`)
    .lte('created_at', `${toDate}T23:59:59.999Z`)

  // 3. Fetch ALL-TIME notes for totals (not date-filtered)
  const { data: allNotes } = await svc
    .from('notes')
    .select('author_id, created_at, status')
    .in('author_id', memberIds)
    .in('status', ['queued', 'printed'])

  // 4. Compute current month for "this month" stat
  const nowYM = new Date().toISOString().slice(0, 7) // YYYY-MM

  // 5. Aggregate per user
  const userMap: Record<string, ActivityUser> = {}

  for (const p of profiles) {
    userMap[p.id] = {
      authorId: p.id,
      name: profileMap[p.id].name,
      firstName: profileMap[p.id].name.split(' ')[0],
      school: profileMap[p.id].school,
      totalNotes: 0,
      thisMonthNotes: 0,
      lastActive: null,
      dailyCounts: {},
    }
  }

  // All-time totals + last active
  for (const n of allNotes ?? []) {
    const u = userMap[n.author_id]
    if (!u) continue
    u.totalNotes++
    if (n.created_at.startsWith(nowYM)) u.thisMonthNotes++
    if (!u.lastActive || n.created_at > u.lastActive) u.lastActive = n.created_at
  }

  // Daily counts within date range
  for (const n of notes ?? []) {
    const u = userMap[n.author_id]
    if (!u) continue
    const day = n.created_at.slice(0, 10)
    u.dailyCounts[day] = (u.dailyCounts[day] ?? 0) + 1
  }

  // 6. Unique schools (sorted)
  const schools = [...new Set(
    Object.values(userMap)
      .map(u => u.school)
      .filter((s): s is string => !!s)
  )].sort()

  // 7. Only return users who have at least one note all-time (skip inactive accounts)
  const users = Object.values(userMap)
    .filter(u => u.totalNotes > 0)
    .sort((a, b) => b.totalNotes - a.totalNotes)

  return NextResponse.json({ users, schools, dateRange: { from: fromDate, to: toDate } })
}
