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
async function buildPrintHtml(notes: Note[], hospital: string | null, branding: 'flowers' | 'notes'): Promise<string> {
  const title = hospital ? HOSPITALS[hospital as keyof typeof HOSPITALS] : 'All Hospitals'
  const orgName = branding === 'flowers' ? 'Flowers for Fighters' : 'Notes for Fighters'
  const footerUrl = branding === 'flowers' ? 'flowersforfighters.base44.app' : 'notesforfighters.vercel.app'

  // Generate QR code once (same URL for all cards)
  const qrDataUrl = await QRCode.toDataURL('https://notesforfighters.vercel.app/for-you', {
    width: 108,
    margin: 1,
    color: { dark: '#1A1A2E', light: '#FDFAF6' },
  })

  const cards = notes.map((note) => `
    <div class="card">
      <div class="card-header">
        <div class="org-name">${escapeHtml(orgName)}</div>
        <div class="subheader">A note for you, Fighter 🌸</div>
        <div class="divider"></div>
      </div>
      <div class="note-body">${escapeHtml(note.body)}</div>
      <div class="card-footer">— ${escapeHtml(note.author_name?.split(' ')[0] ?? 'A volunteer')}, Notes for Fighters Volunteer</div>
      <div class="bottom-strip">
        <div class="footer-url">${escapeHtml(footerUrl)}</div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" class="qr-code" alt="QR" />
          <div class="qr-label">Scan me 🌸</div>
        </div>
      </div>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(orgName)} Notes — ${escapeHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Playfair+Display:ital,wght@0,400;1,400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #f0f0f0;
    font-family: 'Playfair Display', Georgia, serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .card {
    width: 6in;
    height: 4in;
    background: #FDFAF6;
    border: 1px solid #F9DDE0;
    border-radius: 12px;
    padding: 0.35in 0.45in 0.25in;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    margin: 0.25in auto;
    box-shadow: 0 2px 12px rgba(232,99,122,0.08);
    position: relative;
  }

  /* 1. Branding header */
  .org-name {
    font-family: 'Dancing Script', cursive;
    font-weight: 700;
    font-size: 22px;
    color: #E8637A;
    line-height: 1;
    margin-bottom: 4px;
  }

  /* 2. Subheader */
  .subheader {
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: 11px;
    color: #888;
    margin-bottom: 8px;
  }

  /* 3. Divider */
  .divider {
    width: 100%;
    height: 1px;
    background: #F9DDE0;
    margin-bottom: 0.14in;
  }

  .card-header {
    flex-shrink: 0;
  }

  /* 4. Note body */
  .note-body {
    font-family: 'Playfair Display', serif;
    font-size: 13px;
    line-height: 1.8;
    color: #1A1A2E;
    flex: 1;
    white-space: pre-wrap;
    overflow: hidden;
  }

  /* 5. Signature */
  .card-footer {
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: 12px;
    color: #E8637A;
    margin-top: 0.1in;
    padding-right: 1in;
  }

  /* Bottom strip — footer URL + QR */
  .bottom-strip {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: 0.1in;
    padding-top: 0.08in;
    border-top: 1px solid #F5EFE6;
  }

  /* 7. Footer URL */
  .footer-url {
    font-size: 9px;
    color: #aaa;
    font-family: 'Playfair Display', serif;
    align-self: flex-end;
    padding-bottom: 4px;
  }

  /* 6. QR code */
  .qr-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .qr-code {
    width: 0.75in;
    height: 0.75in;
    display: block;
  }

  .qr-label {
    font-size: 7px;
    color: #888;
    text-align: center;
    font-family: 'Playfair Display', serif;
  }

  @media print {
    body { background: white; }
    .card { margin: 0; box-shadow: none; border: none; page-break-after: always; }
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

  const { notes, hospital, branding } = await req.json() as { notes: Note[]; hospital: string | null; branding?: 'flowers' | 'notes' }

  if (!notes || notes.length === 0) {
    return NextResponse.json({ error: 'No notes to print' }, { status: 400 })
  }

  const html = await buildPrintHtml(notes, hospital, branding ?? 'flowers')

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="fff-notes-${hospital ?? 'all'}.html"`,
    },
  })
}
