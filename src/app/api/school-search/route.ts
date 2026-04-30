import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export interface SchoolResult {
  id: string
  name: string
  address: string
  displayName: string
  popular?: boolean
  popularCount?: number
}

// School name aliases — typing these returns the canonical school name
// Key: lowercase alias  →  Value: canonical name (must also be in CURATED)
const SCHOOL_ALIASES: Record<string, string> = {
  'memorial high school': 'Houston Memorial High School',
  'memorial hs': 'Houston Memorial High School',
}

// Curated high schools — always surface correctly regardless of query
const CURATED: Array<{ name: string; address: string }> = [
  { name: 'Diamond Bar High School', address: 'Diamond Bar, CA' },
  { name: 'Ayala High School', address: 'Chino Hills, CA' },
  { name: 'Walnut High School', address: 'Walnut, CA' },
  { name: 'Houston Memorial High School', address: 'Houston, TX' },
  { name: 'Claremont High School', address: 'Claremont, CA' },
  { name: 'Charter Oak High School', address: 'Covina, CA' },
  { name: 'South Hills High School', address: 'West Covina, CA' },
  { name: 'Rowland High School', address: 'Rowland Heights, CA' },
  { name: 'Nogales High School', address: 'La Puente, CA' },
  { name: 'Northview High School', address: 'Covina, CA' },
]

function isHighSchool(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.includes('high school') ||
    (n.includes('high') && (n.includes('school') || n.includes('hs'))) ||
    n.includes('preparatory') ||
    n.includes('prep school') ||
    n.endsWith(' high') ||
    /\bhs\b/.test(n)
  )
}

// Substring match: every word in the query must appear somewhere in the target
function matches(query: string, target: string): boolean {
  const q = query.toLowerCase().trim()
  const t = target.toLowerCase()
  // Check if all words in query appear in target
  return q.split(/\s+/).every(word => t.includes(word))
}

// Fetch schools ordered by how many profiles have selected them
async function getPopularSchools(): Promise<Array<{ name: string; count: number }>> {
  try {
    const svc = createServiceClient()
    const { data } = await svc
      .from('profiles')
      .select('school')
      .not('school', 'is', null)
      .neq('school', '')
    if (!data) return []

    const counts: Record<string, number> = {}
    for (const row of data) {
      const s = (row.school as string)?.trim()
      if (s) counts[s] = (counts[s] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const rawQ = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  // Resolve alias before searching — "Memorial High School" → "Houston Memorial High School"
  const aliasCanonical = SCHOOL_ALIASES[rawQ.toLowerCase()]
  const q = aliasCanonical ? aliasCanonical : rawQ
  const popularOnly = req.nextUrl.searchParams.get('popular') === '1'

  // Popular-only mode: return top schools from DB (used to pre-fill dropdown)
  if (popularOnly) {
    const popular = await getPopularSchools()
    return NextResponse.json(
      popular.map((p, i) => ({
        id: `popular-${i}`,
        name: p.name,
        address: '',
        displayName: p.name,
        popular: true,
        popularCount: p.count,
      }))
    )
  }

  if (q.length < 2) return NextResponse.json([])

  try {
    const seen = new Set<string>()
    const results: SchoolResult[] = []

    // 1. Popular schools from DB that match query (substring)
    const popular = await getPopularSchools()
    for (const p of popular) {
      if (matches(q, p.name) && isHighSchool(p.name)) {
        seen.add(p.name.toLowerCase())
        results.push({
          id: `popular-${p.name}`,
          name: p.name,
          address: '',
          displayName: p.name,
          popular: true,
          popularCount: p.count,
        })
      }
    }

    // 2. Curated schools that match query (substring)
    for (const s of CURATED) {
      if (matches(q, s.name) && !seen.has(s.name.toLowerCase())) {
        seen.add(s.name.toLowerCase())
        results.push({
          id: `curated-${s.name}`,
          name: s.name,
          address: s.address,
          displayName: s.name,
        })
      }
    }

    // 3. Nominatim — try both the raw query and query+"high school"
    const queries = [q]
    if (!/high|school/i.test(q)) queries.push(`${q} high school`)

    for (const searchQ of queries) {
      if (results.length >= 6) break
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(searchQ)}` +
        `&addressdetails=1&limit=10&format=json&dedupe=1`

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'FlowersForFighters/1.0 (notesforfighters.vercel.app)',
          'Accept-Language': 'en',
        },
        next: { revalidate: 60 },
      })
      if (!res.ok) continue

      const data: Array<{
        place_id: number
        display_name: string
      }> = await res.json()

      for (const item of data) {
        if (results.length >= 6) break
        const parts = item.display_name.split(',').map((s: string) => s.trim())
        const name = parts[0]
        if (!isHighSchool(name)) continue
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)

        const addrParts = parts.slice(1).filter((p: string) =>
          !p.match(/^\d{5}/) && p.length > 1
        ).slice(0, 3)

        results.push({
          id: String(item.place_id),
          name,
          address: addrParts.join(', '),
          displayName: item.display_name,
        })
      }
    }

    return NextResponse.json(results.slice(0, 6))
  } catch (err) {
    console.error('[school-search]', err)
    return NextResponse.json([])
  }
}
