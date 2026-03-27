import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return user
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const hospital = searchParams.get('hospital')
  const status = searchParams.get('status')

  let query = supabase.from('notes').select('*').order('created_at', { ascending: false })
  if (hospital) query = query.eq('hospital', hospital)
  if (status) query = query.eq('status', status)

  const { data } = await query
  return NextResponse.json({ notes: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await req.json()

  const update: Record<string, unknown> = { status }
  if (status === 'printed') update.printed_at = new Date().toISOString()

  const { error } = await supabase.from('notes').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
