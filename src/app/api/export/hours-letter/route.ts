import { NextRequest, NextResponse } from 'next/server'

// Returns an HTML letter suitable for printing as a PDF via browser print dialog
// or saving. The user can print-to-PDF from the browser.
function buildLetterHtml(name: string, notes: number, minutes: number, date: string): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  const hoursDisplay = hours > 0 ? `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` : `${minutes} minute${minutes !== 1 ? 's' : ''}`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Volunteer Hours Letter — ${escapeHtml(name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Nunito:wght@400;600;700&display=swap');

  * { box-sizing: border-box; }
  body {
    font-family: 'Nunito', sans-serif;
    max-width: 680px;
    margin: 0 auto;
    padding: 60px 60px;
    background: white;
    color: #1A1A2E;
    line-height: 1.7;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    border-bottom: 2px solid #F9DDE0;
    padding-bottom: 24px;
    margin-bottom: 36px;
  }

  .flower-icon { font-size: 40px; }

  .org-name {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    font-weight: 600;
    color: #1A1A2E;
  }

  .org-tagline {
    font-size: 12px;
    color: #E8637A;
    font-weight: 600;
    margin-top: 2px;
  }

  .date { text-align: right; font-size: 13px; color: #666; margin-bottom: 32px; }

  h2 {
    font-family: 'Playfair Display', serif;
    font-size: 18px;
    margin-bottom: 20px;
    color: #1A1A2E;
  }

  p { margin-bottom: 16px; font-size: 14px; }

  .highlight {
    background: #F9DDE0;
    border-left: 3px solid #E8637A;
    padding: 12px 16px;
    border-radius: 6px;
    margin: 24px 0;
    font-weight: 600;
    font-size: 14px;
  }

  .signature-block { margin-top: 48px; }
  .sig-name { font-family: 'Playfair Display', serif; font-size: 18px; font-style: italic; color: #E8637A; }
  .sig-title { font-size: 13px; color: #666; }

  .footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #F5EFE6;
    font-size: 11px;
    color: #999;
    text-align: center;
  }

  @media print {
    body { padding: 40px; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="flower-icon">🌸</div>
    <div>
      <div class="org-name">Flowers for Fighters</div>
      <div class="org-tagline">Diamond Bar, California &nbsp;·&nbsp; flowersforfighters.base44.app</div>
    </div>
  </div>

  <div class="date">${escapeHtml(date)}</div>

  <h2>Volunteer Hours Verification Letter</h2>

  <p>To Whom It May Concern,</p>

  <p>
    This letter serves to verify the volunteer contributions of <strong>${escapeHtml(name)}</strong>
    through the Flowers for Fighters Note Writer program.
  </p>

  <div class="highlight">
    ${escapeHtml(name)} has written <strong>${notes} encouragement note${notes !== 1 ? 's' : ''}</strong>
    for pediatric hospital patients through our program, accumulating
    <strong>${hoursDisplay}</strong> of volunteer service.
  </div>

  <p>
    The Flowers for Fighters Note Writer program allows volunteers from anywhere in the world
    to write personalized encouragement notes for children and teenagers in pediatric hospitals.
    These notes are printed and tucked into flower bouquets delivered to patients at Shriners
    Children&rsquo;s SoCal, Whittier Hospital Medical Center, HealthBridge Children&rsquo;s Hospital,
    and Pomona Valley Hospital Medical Center.
  </p>

  <p>
    Each note submitted through our program counts as 15 minutes of volunteer service.
    This work directly contributes to the emotional wellbeing of pediatric patients and
    their families during challenging times.
  </p>

  <p>
    We are grateful for ${escapeHtml(name.split(' ')[0])}&rsquo;s meaningful contributions to our mission.
    Please feel free to contact us at flowersforfighters.base44.app if you require any
    additional verification.
  </p>

  <div class="signature-block">
    <p>With gratitude,</p>
    <div class="sig-name">Russell Kuo</div>
    <div class="sig-title">Founder, Flowers for Fighters</div>
    <div class="sig-title">Diamond Bar High School &nbsp;·&nbsp; Diamond Bar, California</div>
  </div>

  <div class="footer">
    Flowers for Fighters &nbsp;·&nbsp; @flowersforfighters &nbsp;·&nbsp; flowersforfighters.base44.app
    <br>This letter was generated on ${escapeHtml(date)} and is valid as of that date.
  </div>
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
  const { name, notes, minutes } = await req.json()

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = buildLetterHtml(name ?? 'Volunteer', notes ?? 0, minutes ?? 0, date)

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="fff-volunteer-hours-letter.html"`,
    },
  })
}
