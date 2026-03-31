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

// Build HTML for the print PDF
// Layout: 8.5×11" letter paper, 0.25" margins, 2 landscape 6×4" cards per page (stacked)
// Each card has a dashed cut border. Cards grouped in pairs — one .sheet per page.
async function buildPrintHtml(notes: Note[], hospital: string | null, branding: 'flowers' | 'notes'): Promise<string> {
  const title     = hospital ? HOSPITALS[hospital as keyof typeof HOSPITALS] : 'All Hospitals'
  const orgName   = branding === 'flowers' ? 'Flowers for Fighters' : 'Notes for Fighters'
  const footerUrl = branding === 'flowers' ? 'flowersforfighters.base44.app' : 'notesforfighters.vercel.app'

  // QR code — small, sharp, base64 so it prints offline
  const qrDataUrl = await QRCode.toDataURL('https://notesforfighters.vercel.app/for-you', {
    width: 120,
    margin: 1,
    color: { dark: '#1A1A2E', light: '#FFFFFF' },
  })

  // Build individual card HTML
  const cardHtml = (note: Note) => `
    <div class="card">
      <div class="header">
        <div class="org-name">${escapeHtml(orgName)}</div>
        <div class="subheader">A note for you, Fighter 🌷</div>
        <div class="divider"></div>
      </div>
      <div class="body-wrap">
        <div class="note-body">${escapeHtml(note.body)}</div>
      </div>
      <div class="footer-row">
        <div class="footer-left">
          <div class="signature">&#8212;&nbsp;${escapeHtml(note.author_name?.split(' ')[0] ?? 'A volunteer')}, Notes for Fighters Volunteer</div>
          <div class="footer-url">${escapeHtml(footerUrl)}</div>
        </div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" class="qr-code" alt="QR code" />
          <div class="qr-label">Scan me 🌷</div>
        </div>
      </div>
    </div>`

  // Group notes into sets of 6 → one .sheet per page (2 cols × 3 rows)
  const sheets: string[] = []
  for (let i = 0; i < notes.length; i += 6) {
    const batch = notes.slice(i, i + 6)
    // Pad to 6 so the grid stays full
    while (batch.length < 6) batch.push(null as unknown as Note)
    const cards = batch.map((n) => n ? cardHtml(n) : '<div class="card card-blank"></div>').join('')
    sheets.push(`<div class="sheet">${cards}</div>`)
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(orgName)} — ${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Letter page: 8.5×11 in, 0.25 in margins ── */
    @page {
      size: 8.5in 11in;
      margin: 0.25in;
    }

    html, body {
      width: 8.5in;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Sheet: 2-col × 3-row grid, 6 cards per page ── */
    .sheet {
      width: 8in;          /* 8.5in − 2×0.25in margin */
      height: 10.5in;      /* 11in − 2×0.25in margin */
      display: grid;
      grid-template-columns: 4in 4in;
      grid-template-rows: 3.5in 3.5in 3.5in;
      break-after: page;
      page-break-after: always;
      overflow: hidden;
    }
    .sheet:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    /* ── Card: 4×3.5 in with dashed cut border ── */
    .card {
      width: 4in;
      height: 3.5in;
      background: #FFFFFF;
      padding: 0.2in 0.25in 0.15in 0.25in;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1.5px dashed #cccccc;
    }

    /* Blank placeholder for odd-note pages */
    .card-blank { background: #fff; }

    /* ── Header ── */
    .header { flex-shrink: 0; margin-bottom: 10px; }

    .org-name {
      font-family: 'Dancing Script', cursive;
      font-weight: 700;
      font-size: 22px;
      color: #E8637A;
      line-height: 1.15;
      margin-bottom: 2px;
    }

    .subheader {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 9px;
      color: #aaaaaa;
      margin-bottom: 7px;
    }

    .divider {
      width: 100%;
      height: 1px;
      background: #F9DDE0;
    }

    /* ── Body ── */
    .body-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 14px 0;
      overflow: hidden;
    }

    .note-body {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 11px;
      line-height: 1.75;
      color: #1A1A2E;
      white-space: pre-wrap;
      word-break: break-word;
      width: 100%;
    }

    /* ── Footer ── */
    .footer-row {
      flex-shrink: 0;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8px;
    }

    .footer-left { display: flex; flex-direction: column; gap: 3px; }

    .signature {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 11px;
      color: #E8637A;
    }

    .footer-url {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 9px;
      color: #cccccc;
    }

    /* ── QR ── */
    .qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }

    .qr-code { width: 54px; height: 54px; display: block; }

    .qr-label {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 7.5px;
      color: #aaaaaa;
      text-align: center;
    }

    @media print {
      html, body { background: #fff; }
    }
  </style>
</head>
<body>
${sheets.join('\n')}
<script>
  // Auto-scale note body font down (min 10px) if text overflows within body-wrap
  function fitNotes() {
    document.querySelectorAll('.body-wrap').forEach(function(wrap) {
      var body = wrap.querySelector('.note-body');
      if (!body) return;
      var size = 13;
      body.style.fontSize = size + 'px';
      while (wrap.scrollHeight > wrap.clientHeight && size > 10) {
        size -= 0.5;
        body.style.fontSize = size + 'px';
      }
      if (wrap.scrollHeight > wrap.clientHeight) {
        body.style.overflow = 'hidden';
        wrap.style.overflow = 'hidden';
      }
    });
  }
  function ready() {
    fitNotes();
    // Short delay so Google Fonts finish loading before the print dialog opens
    setTimeout(function() { window.print(); }, 800);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
  window.addEventListener('beforeprint', fitNotes);
</script>
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
