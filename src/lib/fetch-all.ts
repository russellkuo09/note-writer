import type { PostgrestError } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

interface RangeQuery<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
}

// Supabase caps every .select() at 1000 rows. Use this to page through everything.
// The factory is called once per page because a PostgrestFilterBuilder can only be awaited once.
export async function fetchAllRows<T>(
  build: () => RangeQuery<T>,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const all: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await build().range(offset, offset + PAGE_SIZE - 1)
    if (error) return { data: all, error }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return { data: all, error: null }
}
