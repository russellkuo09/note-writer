import { NextRequest, NextResponse } from 'next/server'

export interface SchoolResult {
  id: string
  name: string
  address: string
  displayName: string
}

// Only show results that look like high schools
function isHighSchool(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.includes('high school') ||
    (n.includes('high') && (n.includes('school') || n.includes('hs'))) ||
    n.includes('preparatory') ||
    n.includes('prep school') ||
    n.endsWith(' high') ||
    n.includes(' high ') ||
    /\bhs\b/.test(n)
  )
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  try {
    // Bias the query toward high schools
    const biased = /high|school|prep|hs\b/i.test(q) ? q : `${q} high school`

    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(biased)}` +
      `&addressdetails=1&limit=12&format=json&dedupe=1`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'FlowersForFighters/1.0 (notesforfighters.vercel.app)',
        'Accept-Language': 'en',
      },
      next: { revalidate: 60 },
    })

    if (!res.ok) return NextResponse.json([])

    const data: Array<{
      place_id: number
      display_name: string
      type: string
      class: string
      address: Record<string, string>
    }> = await res.json()

    const seen = new Set<string>()
    const results: SchoolResult[] = []

    for (const item of data) {
      const parts = item.display_name.split(',').map(s => s.trim())
      const name = parts[0]

      // Skip non-high-school results
      if (!isHighSchool(name)) continue

      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const addrParts = parts.slice(1).filter(p =>
        !p.match(/^\d{5}/) && p.length > 1
      ).slice(0, 3)

      results.push({
        id: String(item.place_id),
        name,
        address: addrParts.join(', '),
        displayName: item.display_name,
      })

      if (results.length >= 6) break
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('[school-search]', err)
    return NextResponse.json([])
  }
}
