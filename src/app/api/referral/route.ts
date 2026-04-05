import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { ref_code, new_user_id } = await req.json() as { ref_code: string; new_user_id: string }

    if (!ref_code || !new_user_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Find referrer by referral_code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('referral_code', ref_code)
      .single()

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
    }

    // Don't let users refer themselves
    if (referrer.id === new_user_id) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
    }

    // Check if new user already has a referrer
    const { data: newUserProfile } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('id', new_user_id)
      .single()

    if (newUserProfile?.referred_by) {
      // Already has a referrer, don't overwrite
      return NextResponse.json({ message: 'Already referred' })
    }

    // Set referred_by on the new user
    await supabase
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', new_user_id)

    return NextResponse.json({ referrer: { id: referrer.id, name: referrer.name } })
  } catch (error) {
    console.error('Referral error:', error)
    return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 })
  }
}
