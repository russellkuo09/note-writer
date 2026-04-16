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

export interface SchoolStat {
  school: string
  volunteers: number
  totalNotes: number
  monthNotes: number
}

export async function GET() {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // Fetch all profiles — gracefully handle missing school column
  let profiles: Array<{ id: string; school?: string | null }> = []
  const withSchool = await svc.from('profiles').select('id, school')
  if (!withSchool.error && withSchool.data) {
    profiles = withSchool.data
  } else {
    // school column not yet migrated — return empty, nothing to show
    return NextResponse.json([])
  }

  // Fetch all non-archived notes
  const { data: notes } = await svc
    .from('notes')
    .select('author_id, created_at')
    .neq('status', 'archived')

  if (!notes) {
    return NextResponse.json([])
  }

  // Build a map of user_id → school
  const schoolByUser: Record<string, string> = {}
  for (const p of profiles) {
    const s = (p.school as string | null)?.trim()
    if (s) schoolByUser[p.id] = s
  }

  // This month prefix: "YYYY-MM"
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Aggregate per school
  const bySchool: Record<string, { volunteers: Set<string>; totalNotes: number; monthNotes: number }> = {}

  for (const note of notes) {
    const school = schoolByUser[note.author_id]
    if (!school) continue
    if (!bySchool[school]) bySchool[school] = { volunteers: new Set(), totalNotes: 0, monthNotes: 0 }
    bySchool[school].volunteers.add(note.author_id)
    bySchool[school].totalNotes++
    if (note.created_at.startsWith(thisMonth)) bySchool[school].monthNotes++
  }

  const result: SchoolStat[] = Object.entries(bySchool)
    .map(([school, stats]) => ({
      school,
      volunteers: stats.volunteers.size,
      totalNotes: stats.totalNotes,
      monthNotes: stats.monthNotes,
    }))
    .sort((a, b) => b.totalNotes - a.totalNotes)

  return NextResponse.json(result)
}
