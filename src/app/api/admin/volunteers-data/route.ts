import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase-server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return user
}

export interface VolunteerData {
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

export async function GET() {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // Fetch profiles — try with school column first, gracefully fall back
  let profileData: Array<{ id: string; name: string | null; email: string | null; location: string | null; school?: string | null; role: string | null; referral_bonus_minutes: number | null }> = []

  const withSchool = await svc
    .from('profiles')
    .select('id, name, email, location, role, referral_bonus_minutes, school')

  if (withSchool.error) {
    // school column doesn't exist yet — fetch without it
    const withoutSchool = await svc
      .from('profiles')
      .select('id, name, email, location, role, referral_bonus_minutes')
    profileData = withoutSchool.data ?? []
  } else {
    profileData = withSchool.data ?? []
  }

  // Fetch volunteer_hours joined with non-archived notes
  const { data: hoursRows } = await svc
    .from('volunteer_hours')
    .select('user_id, minutes, notes!inner(status)')
    .neq('notes.status', 'archived')

  // Aggregate per user
  const byUser: Record<string, { notes: number; noteMinutes: number }> = {}
  for (const h of hoursRows ?? []) {
    if (!byUser[h.user_id]) byUser[h.user_id] = { notes: 0, noteMinutes: 0 }
    byUser[h.user_id].notes++
    byUser[h.user_id].noteMinutes += h.minutes
  }

  const rows = profileData
    .map((p) => {
      const stats = byUser[p.id] ?? { notes: 0, noteMinutes: 0 }
      const referralMinutes = p.referral_bonus_minutes ?? 0
      const totalMinutes = stats.noteMinutes + referralMinutes
      return {
        name: p.name ?? '',
        email: p.email ?? '',
        location: p.location ?? '',
        school: (p.school as string | null | undefined) ?? '',
        role: p.role ?? '',
        notes: stats.notes,
        noteMinutes: stats.noteMinutes,
        referralMinutes,
        totalMinutes,
        totalHours: (totalMinutes / 60).toFixed(2),
      }
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name))
    .map((r, i) => ({ rank: i + 1, ...r }))

  return NextResponse.json(rows)
}
