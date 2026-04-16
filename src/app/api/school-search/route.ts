import { NextRequest, NextResponse } from 'next/server'

export interface SchoolResult {
  id: string
  name: string
  address: string
  displayName: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}` +
      `&addressdetails=1&limit=8&format=json&dedupe=1`

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

    // Parse + deduplicate results
    const seen = new Set<string>()
    const results: SchoolResult[] = []

    for (const item of data) {
      const parts = item.display_name.split(',').map(s => s.trim())
      const name = parts[0]
      // Build a short address: city/town + state/county + country (max 3 segments)
      const addrParts = parts.slice(1).filter(p =>
        !p.match(/^\d{5}/) // skip zip codes
        && p.length > 1
      ).slice(0, 3)
      const address = addrParts.join(', ')

      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      results.push({
        id: String(item.place_id),
        name,
        address,
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
