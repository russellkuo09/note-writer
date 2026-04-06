import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data: notes } = await supabase
      .from('notes')
      .select('id, body, author_name, hospital')
      .in('status', ['queued', 'printed'])
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ notes: notes ?? [] })
  } catch {
    return NextResponse.json({ notes: [] })
  }
}
