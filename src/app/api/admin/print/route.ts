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

// Build HTML for the print PDF — each note as a 4x6 card, one page per note
async function buildPrintHtml(notes: Note[], hospital: string | null, branding: 'flowers' | 'notes'): Promise<string> {
  const title    = hospital ? HOSPITALS[hospital as keyof typeof HOSPITALS] : 'All Hospitals'
  const orgName  = branding === 'flowers' ? 'Flowers for Fighters' : 'Notes for Fighters'
  const footerUrl = branding === 'flowers' ? 'flowersforfighters.base44.app' : 'notesforfighters.vercel.app'

  // QR code as base64 PNG so it renders offline / in print dialogs
  const qrDataUrl = await QRCode.toDataURL('https://notesforfighters.vercel.app/for-you', {
    width: 80,
    margin: 1,
    color: { dark: '#1A1A2E', light: '#FFFFFF' },
  })

  const cards = notes.map((note) => `
    <div class="card">

      <!-- HEADER -->
      <div class="header">
        <div class="org-name">${escapeHtml(orgName)}</div>
        <div class="subheader">A note for you, Fighter 🌸</div>
        <div class="divider"></div>
      </div>

      <!-- BODY — grows to fill available space -->
      <div class="body-wrap">
        <div class="note-body">${escapeHtml(note.body)}</div>
      </div>

      <!-- FOOTER ROW — signature left, QR right -->
      <div class="footer-row">
        <div class="footer-left">
          <div class="signature">&#8212;&nbsp;${escapeHtml(note.author_name?.split(' ')[0] ?? 'A volunteer')}, Notes for Fighters Volunteer</div>
          <div class="footer-url">${escapeHtml(footerUrl)}</div>
        </div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" class="qr-code" alt="Scan me" />
          <div class="qr-label">Scan me 🌸</div>
        </div>
      </div>

    </div>
  `).join('')

  // Google Fonts loaded via <link> — more reliable than @import for print
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(orgName)} — ${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page setup ── */
    @page {
      size: 6in 4in;
      margin: 0;
    }

    html, body {
      width: 6in;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Card ── */
    .card {
      width: 6in;
      height: 4in;
      background: #FFFFFF;
      padding: 48px;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      position: relative;
    }

    /* ── Header ── */
    .header { flex-shrink: 0; margin-bottom: 14px; }

    .org-name {
      font-family: 'Dancing Script', cursive;
      font-weight: 700;
      font-size: 36px;
      color: #E8637A;
      line-height: 1.1;
      margin-bottom: 4px;
    }

    .subheader {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 12px;
      color: #aaaaaa;
      margin-bottom: 12px;
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
      padding: 18px 0;
      overflow: hidden;
    }

    .note-body {
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: 400;
      font-style: normal;
      font-size: 15px;
      line-height: 2.0;
      color: #1A1A2E;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ── Footer row ── */
    .footer-row {
      flex-shrink: 0;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
    }

    .footer-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .signature {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 13px;
      color: #E8637A;
    }

    .footer-url {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 10px;
      color: #cccccc;
    }

    /* ── QR ── */
    .qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
    }

    .qr-code {
      width: 60px;
      height: 60px;
      display: block;
    }

    .qr-label {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 8px;
      color: #aaaaaa;
      text-align: center;
    }

    @media print {
      html, body { background: #fff; }
      .card { margin: 0; }
    }
  </style>
</head>
<body>
${cards}
<script>
  // Auto-scale note body font down (min 11px) if text overflows the card
  function fitNotes() {
    document.querySelectorAll('.body-wrap').forEach(function(wrap) {
      var body = wrap.querySelector('.note-body');
      if (!body) return;
      var size = 15;
      body.style.fontSize = size + 'px';
      while (wrap.scrollHeight > wrap.clientHeight && size > 11) {
        size -= 0.5;
        body.style.fontSize = size + 'px';
      }
      // Hard clamp — never let text bleed out
      if (wrap.scrollHeight > wrap.clientHeight) {
        body.style.overflow = 'hidden';
        wrap.style.overflow = 'hidden';
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fitNotes);
  } else {
    fitNotes();
  }
  // Also run just before printing in case layout shifted
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
