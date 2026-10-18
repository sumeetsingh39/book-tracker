import { supabase } from './supabase'
import type { HardcoverSeries } from './types'

// Calls to the `hardcover` edge function, which holds the Hardcover API key.

export interface Candidate {
  id: number
  name: string
  slug: string
  booksCount: number
  books: string[]
  alternateNames: string[]
  image: string | null
}

export interface SeriesCandidate {
  id: number
  name: string
  slug: string
  booksCount: number
  authorName: string | null
  books: string[]
}

export interface ScanResult {
  checkedAt: string
  authors: number
  books: number
  new: number
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('hardcover', { body })
  if (error) {
    // The function answers errors as { error }; surface that rather than "non-2xx".
    const context = (error as { context?: Response }).context
    const detail = context ? await context.json().catch(() => null) : null
    throw new Error(detail?.error ?? error.message)
  }
  if (data?.error) throw new Error(String(data.error))
  return data as T
}

export const searchAuthors = (query: string) =>
  call<{ candidates: Candidate[] }>({ action: 'search', query }).then((r) => r.candidates)

export const searchSeries = (query: string) =>
  call<{ candidates: SeriesCandidate[] }>({ action: 'search', type: 'series', query }).then(
    (r) => r.candidates,
  )

export const linkSeries = (authorId: number, series: HardcoverSeries[]) =>
  call({ action: 'link-series', authorId, series })

export const linkByGoodreads = () =>
  call<{ linked: number; remaining: number }>({ action: 'link-goodreads' })

export const linkAuthor = (authorId: number, candidate: Candidate) =>
  call({ action: 'link', authorId, hardcoverId: candidate.id, slug: candidate.slug })

export const skipAuthor = (authorId: number) => call({ action: 'skip', authorId })

export const unlinkAuthor = (authorId: number) => call({ action: 'unlink', authorId })

export const scanHardcover = () => call<ScanResult>({ action: 'scan' })

export const hardcoverAuthorUrl = (slug: string) => `https://hardcover.app/authors/${slug}`
export const hardcoverBookUrl = (slug: string) => `https://hardcover.app/books/${slug}`
export const hardcoverSeriesUrl = (slug: string) => `https://hardcover.app/series/${slug}`

const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// A "clear match": exactly one candidate carries this exact name (or has it as
// an alternate name), so linking needs no judgement.
export function clearMatch(name: string, candidates: Candidate[]): Candidate | null {
  const target = fold(name)
  const hits = candidates.filter(
    (c) => fold(c.name) === target || c.alternateNames.some((n) => fold(n) === target),
  )
  return hits.length === 1 && hits[0].booksCount > 0 ? hits[0] : null
}
