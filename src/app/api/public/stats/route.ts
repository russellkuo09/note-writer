import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { count } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'archived')

    const total_notes = count ?? 0
    const fighters_reached = total_notes

    return NextResponse.json({ total_notes, fighters_reached })
  } catch (error) {
    console.error('Public stats error:', error)
    return NextResponse.json({ total_notes: 0, fighters_reached: 0 })
  }
}
