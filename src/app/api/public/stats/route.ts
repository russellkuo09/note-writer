import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = createServiceClient()

    // Notes: queued + printed only (excludes archived/draft)
    const { count: noteCount } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .in('status', ['queued', 'printed'])

    // Volunteers: all profiles (service role bypasses RLS)
    // Counts everyone who has created an account, regardless of role
    const { count: profileCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    const total_notes = noteCount ?? 0
    const total_volunteers = profileCount ?? 0

    console.log('[/api/public/stats] notes:', total_notes, 'profiles/volunteers:', total_volunteers)

    return NextResponse.json({ total_notes, total_volunteers })
  } catch (error) {
    console.error('[/api/public/stats] error:', error)
    return NextResponse.json({ total_notes: 0, total_volunteers: 0 })
  }
}
