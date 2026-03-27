import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return user
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
    const csv = [
      'Name,Email,Notes Written,Total Minutes,Total Hours',
      'Sarah M.,sarah@example.com,12,180,3.00',
      'James K.,james@example.com,8,120,2.00',
      'Emily R.,emily@example.com,25,375,6.25',
    ].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="fff-volunteer-hours.csv"',
      },
    })
  }

  // Aggregate volunteer data
  const { data: profiles } = await supabase.from('profiles').select('id, name, email')
  const { data: hours } = await supabase.from('volunteer_hours').select('user_id, minutes')

  if (!profiles) return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })

  const hoursByUser: Record<string, { notes: number; minutes: number }> = {}

  for (const h of hours ?? []) {
    if (!hoursByUser[h.user_id]) hoursByUser[h.user_id] = { notes: 0, minutes: 0 }
    hoursByUser[h.user_id].notes++
    hoursByUser[h.user_id].minutes += h.minutes
  }

  const rows = profiles.map((p) => {
    const stats = hoursByUser[p.id] ?? { notes: 0, minutes: 0 }
    const totalHours = (stats.minutes / 60).toFixed(2)
    return `"${p.name}","${p.email}",${stats.notes},${stats.minutes},${totalHours}`
  })

  const csv = ['Name,Email,Notes Written,Total Minutes,Total Hours', ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="fff-volunteer-hours-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
