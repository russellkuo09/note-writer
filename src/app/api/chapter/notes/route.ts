import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  // 1. Auth — require chapter_lead or admin role
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isChapterLead = profile?.role === 'chapter_lead'

  if (!isAdmin && !isChapterLead) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Determine which school to view
  //    - Admins can pass ?school= to view any chapter
  //    - Chapter leads always see their own school
  let chapterLeadSchool: string | null = null
  if (isAdmin) {
    const schoolParam = req.nextUrl.searchParams.get('school')?.trim() ?? null
    chapterLeadSchool = schoolParam
    // If admin didn't pass a school, return empty (they need to pick one)
    if (!chapterLeadSchool) {
      return NextResponse.json({ school: null, notes: [], stats: { totalNotes: 0, thisMonthNotes: 0, volunteerCount: 0, leaderboard: [] } })
    }
  } else {
    chapterLeadSchool = profile?.school ?? null
  }
  if (!chapterLeadSchool) {
    return NextResponse.json({ school: null, notes: [], stats: {} })
  }

  // 3. Use service client to fetch school members and their notes
  const svc = createServiceClient()

  const { data: members } = await svc
    .from('profiles')
    .select('id, name')
    .eq('school', chapterLeadSchool)

  const memberIds = (members ?? []).map((m: { id: string }) => m.id)

  const memberNameMap: Record<string, string> = {}
  for (const m of members ?? []) {
    memberNameMap[(m as { id: string; name: string }).id] = (m as { id: string; name: string }).name
  }

  if (memberIds.length === 0) {
    return NextResponse.json({
      school: chapterLeadSchool,
      notes: [],
      stats: {
        totalNotes: 0,
        thisMonthNotes: 0,
        volunteerCount: 0,
        leaderboard: [],
      },
    })
  }

  const { data: notes } = await svc
    .from('notes')
    .select('id, author_id, author_name, hospital, body, created_at, status')
    .in('author_id', memberIds)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  const allNotes = notes ?? []

  // 4. Compute stats
  const totalNotes = allNotes.length

  const currentYearMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const thisMonthNotes = allNotes.filter((n: { created_at: string }) =>
    n.created_at.startsWith(currentYearMonth)
  ).length

  const uniqueAuthorIds = new Set(allNotes.map((n: { author_id: string }) => n.author_id))
  const volunteerCount = uniqueAuthorIds.size

  // Leaderboard: count notes per author_id, join names, sort desc, top 10
  const countByAuthor: Record<string, number> = {}
  for (const n of allNotes) {
    const note = n as { author_id: string }
    countByAuthor[note.author_id] = (countByAuthor[note.author_id] ?? 0) + 1
  }

  const leaderboard = Object.entries(countByAuthor)
    .map(([authorId, count]) => ({
      name: memberNameMap[authorId] ?? 'Unknown',
      noteCount: count,
    }))
    .sort((a, b) => b.noteCount - a.noteCount)
    .slice(0, 10)

  return NextResponse.json({
    school: chapterLeadSchool,
    notes: allNotes,
    stats: {
      totalNotes,
      thisMonthNotes,
      volunteerCount,
      leaderboard,
    },
  })
}
