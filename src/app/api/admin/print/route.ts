import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { Note } from '@/types'
import { HOSPITALS } from '@/types'
import QRCode from 'qrcode'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return user
}

// Build HTML for the print PDF — each note as a 4x6 card
async function buildPrintHtml(notes: Note[], hospital: string | null): Promise<string> {
  const title = hospital ? HOSPITALS[hospital as keyof typeof HOSPITALS] : 'All Hospitals'

  // Generate QR code once (same URL for all cards)
  const qrDataUrl = await QRCode.toDataURL('https://notesforfighters.vercel.app/for-you', { width: 100, margin: 1 })

  const cards = notes.map((note) => `
    <div class="card">
      <div class="card-header">
        <div class="flower">🌸</div>
        <div class="header-text">
          <div class="org-name">Flowers for Fighters</div>
          <div class="subtitle">A note for you, Fighter 🌸</div>
        </div>
      </div>
      <div class="note-body">${escapeHtml(note.body)}</div>
      <div class="card-footer">— ${escapeHtml(note.author_name?.split(' ')[0] ?? 'A volunteer')}, Notes for Fighters Volunteer</div>
      <img src="${qrDataUrl}" class="qr-code" alt="QR code" />
      <div class="qr-label">Scan me 🌸</div>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Flowers for Fighters Notes — ${escapeHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Nunito:wght@400;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #f0f0f0;
    font-family: 'Nunito', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .card {
    width: 6in;
    height: 4in;
    background: #FDFAF6;
    border: 1px solid #F9DDE0;
    border-radius: 16px;
    padding: 0.4in 0.45in;
    display: flex;
    flex-direction: column;
    gap: 0.18in;
    page-break-after: always;
    margin: 0.25in auto;
    box-shadow: 0 2px 12px rgba(232,99,122,0.08);
    position: relative;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid #F9DDE0;
    padding-bottom: 0.12in;
  }

  .flower { font-size: 28px; }

  .org-name {
    font-family: 'Playfair Display', serif;
    font-size: 14pt;
    font-weight: 600;
    color: #1A1A2E;
  }

  .subtitle {
    font-size: 9pt;
    color: #E8637A;
    font-weight: 600;
    margin-top: 2px;
  }

  .note-body {
    font-family: 'Playfair Display', serif;
    font-size: 12pt;
    line-height: 1.7;
    color: #1A1A2E;
    flex: 1;
    white-space: pre-wrap;
    font-style: italic;
  }

  .card-footer {
    font-size: 9pt;
    color: #7BAE8A;
    font-weight: 600;
    border-top: 1px solid #F5EFE6;
    padding-top: 0.1in;
    text-align: right;
    padding-right: 1in;
  }

  .qr-code {
    width: 0.75in;
    height: 0.75in;
    position: absolute;
    bottom: 0.3in;
    right: 0.4in;
  }

  .qr-label {
    position: absolute;
    bottom: 0.15in;
    right: 0.4in;
    width: 0.75in;
    text-align: center;
    font-size: 7pt;
    color: #E8637A;
    font-weight: 600;
  }

  @media print {
    body { background: white; }
    .card { margin: 0; box-shadow: none; page-break-after: always; }
  }
</style>
</head>
<body>
${cards}
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Allow demo mode (no auth check) for preview purposes
  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === ''

  if (!isDemoMode) {
    const admin = await requireAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { notes, hospital } = await req.json() as { notes: Note[]; hospital: string | null }

  if (!notes || notes.length === 0) {
    return NextResponse.json({ error: 'No notes to print' }, { status: 400 })
  }

  const html = await buildPrintHtml(notes, hospital)

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="fff-notes-${hospital ?? 'all'}.html"`,
    },
  })
}
