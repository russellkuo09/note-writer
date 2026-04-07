import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hospital, patient_prompt, body, dedication } = await req.json()

    if (!hospital || !body || body.trim().length < 85) {
      return NextResponse.json({ error: 'Invalid note' }, { status: 400 })
    }

    // Get profile for author_name, streak data, referral info
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, current_streak, longest_streak, last_note_date, referred_by, referral_bonus_minutes')
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
        dedication: dedication ? dedication.trim().slice(0, 60) : null,
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

    // ── Streak calculation ────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    const lastNoteDate = profile?.last_note_date ?? null
    let currentStreak = profile?.current_streak ?? 0
    let longestStreak = profile?.longest_streak ?? 0

    if (lastNoteDate === today) {
      // Already wrote today — keep streak as is
    } else if (lastNoteDate === yesterday) {
      currentStreak = currentStreak + 1
    } else {
      currentStreak = 1
    }

    if (currentStreak > longestStreak) longestStreak = currentStreak

    await supabase
      .from('profiles')
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_note_date: today,
      })
      .eq('id', user.id)

    // ── Referral bonus: check if this is user's first note ───────────────
    const { count: noteCount } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id)

    const isFirstNote = noteCount === 1

    if (isFirstNote && profile?.referred_by) {
      const referrerId = profile.referred_by
      // Get referrer's current bonus
      const { data: referrer } = await supabase
        .from('profiles')
        .select('referral_bonus_minutes, referral_count')
        .eq('id', referrerId)
        .single()

      if (referrer) {
        await supabase
          .from('profiles')
          .update({
            referral_bonus_minutes: (referrer.referral_bonus_minutes ?? 0) + 30,
            referral_count: (referrer.referral_count ?? 0) + 1,
          })
          .eq('id', referrerId)

        // Log bonus volunteer hours for referrer
        await supabase.from('volunteer_hours').insert({
          user_id: referrerId,
          note_id: note.id,
          minutes: 30,
        })
      }
    }

    return NextResponse.json({ note, new_streak: currentStreak })
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
