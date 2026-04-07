import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return user
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  const supabase = await createClient()

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === ''

  if (!isDemoMode) {
    const admin = await requireAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Demo CSV
  if (isDemoMode) {
    const rows = [
      ['Rank', 'Name', 'Email', 'Location', 'Notes Written', 'Note Minutes', 'Referral Bonus Minutes', 'Total Minutes', 'Total Hours'],
      ['1', 'Emily R.', 'emily@example.com', 'Los Angeles, CA', '25', '375', '30', '405', '6.75'],
      ['2', 'Sarah M.', 'sarah@example.com', 'Diamond Bar, CA', '12', '180', '0', '180', '3.00'],
      ['3', 'James K.', 'james@example.com', '', '8', '120', '30', '150', '2.50'],
    ]
    const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="fff-volunteer-hours.csv"',
      },
    })
  }

  // Use service role client to bypass RLS
  const svc = createServiceClient()

  // 1. All profiles
  const { data: profiles, error: profilesError } = await svc
    .from('profiles')
    .select('id, name, email, location, role, referral_bonus_minutes')

  if (profilesError || !profiles) {
    console.error('[export/csv] profiles error:', profilesError)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }

  // 2. volunteer_hours joined with non-archived notes only
  const { data: hoursRows, error: hoursError } = await svc
    .from('volunteer_hours')
    .select('user_id, minutes, notes!inner(status)')
    .neq('notes.status', 'archived')

  if (hoursError) {
    console.error('[export/csv] volunteer_hours error:', hoursError)
  }

  // 3. Aggregate minutes + note count per user
  const byUser: Record<string, { notes: number; noteMinutes: number }> = {}
  for (const h of hoursRows ?? []) {
    if (!byUser[h.user_id]) byUser[h.user_id] = { notes: 0, noteMinutes: 0 }
    byUser[h.user_id].notes++
    byUser[h.user_id].noteMinutes += h.minutes
  }

  // 4. Build rows — include everyone with any activity OR any profile
  const dataRows = profiles
    .map((p) => {
      const stats = byUser[p.id] ?? { notes: 0, noteMinutes: 0 }
      const referralMinutes = p.referral_bonus_minutes ?? 0
      const totalMinutes = stats.noteMinutes + referralMinutes
      const totalHours = (totalMinutes / 60).toFixed(2)
      return {
        name: p.name ?? '',
        email: p.email ?? '',
        location: p.location ?? '',
        role: p.role ?? '',
        notes: stats.notes,
        noteMinutes: stats.noteMinutes,
        referralMinutes,
        totalMinutes,
        totalHours: parseFloat(totalHours),
      }
    })
    // Sort by total minutes descending, then name
    .sort((a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name))

  // 5. Build CSV
  const header = [
    'Rank',
    'Name',
    'Email',
    'Location',
    'Role',
    'Notes Written',
    'Note Minutes',
    'Referral Bonus Minutes',
    'Total Minutes',
    'Total Hours',
  ]

  const csvRows = dataRows.map((r, i) => [
    i + 1,
    r.name,
    r.email,
    r.location,
    r.role,
    r.notes,
    r.noteMinutes,
    r.referralMinutes,
    r.totalMinutes,
    r.totalHours.toFixed(2),
  ].map(escapeCsv).join(','))

  const csv = [header.join(','), ...csvRows].join('\n')

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fff-volunteer-hours-${today}.csv"`,
    },
  })
}
