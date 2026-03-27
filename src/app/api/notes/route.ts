import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hospital, patient_prompt, body } = await req.json()

    if (!hospital || !body || body.trim().length < 20) {
      return NextResponse.json({ error: 'Invalid note' }, { status: 400 })
    }

    // Get profile for author_name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    // Insert note
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .insert({
        author_id: user.id,
        author_name: profile?.name ?? 'Anonymous',
        hospital,
        patient_prompt: patient_prompt ?? null,
        body: body.trim(),
        status: 'queued',
      })
      .select()
      .single()

    if (noteError) throw noteError

    // Log volunteer hours
    await supabase.from('volunteer_hours').insert({
      user_id: user.id,
      note_id: note.id,
      minutes: 15,
    })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Note submit error:', error)
    return NextResponse.json({ error: 'Failed to submit note' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: notes } = await supabase
      .from('notes')
      .select('*')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ notes: notes ?? [] })
  } catch (error) {
    console.error('Notes fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}
