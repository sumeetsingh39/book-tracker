// Book discovery from Hardcover (https://hardcover.app). The Hardcover API key
// must stay server-side, so the site calls this function for:
//   { action: 'search', query, type? }  author (or, with type 'series', series)
//                                 candidates for manual linking
//   { action: 'link-goodreads' }  link unlinked authors whose Goodreads author
//                                 id Hardcover also knows (exact, no guessing)
//   { action: 'link', authorId, hardcoverId, slug } / { action: 'skip', authorId }
//   { action: 'link-series', authorId, series: [{ id, name, slug }] }  follow
//                                 Hardcover series (entries that are a series)
//   { action: 'scan' }            check linked authors for future books and file
//                                 them as suggestions
// Secrets: HARDCOVER_TOKEN (a Hardcover API key), plus the usual SUPABASE_*.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.102.1'

const API = 'https://api.hardcover.app/v1/graphql'
const AUTHOR_CHUNK = 60 // linked authors per books query (pen names add more ids)
const SERIES_CHUNK = 100 // followed series per books query
const GOODREADS_CHUNK = 40 // Goodreads ids per author lookup

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })

// Hardcover meters each top-level field of a query against a small bucket
// (burst 10 on the free plan) that refills about one per second. Track what is
// left from the RateLimit header and wait for refills instead of failing.
let bucket = { remaining: Infinity, at: 0 }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function readRateLimit(res: Response) {
  // e.g. `"Free";r=9;t=0, "daily";r=4999;t=20330`: the first entry is the bucket.
  const m = /r=(\d+)/.exec(res.headers.get('ratelimit') ?? '')
  if (m) bucket = { remaining: Number(m[1]), at: Date.now() }
}

async function hardcover<T>(
  query: string,
  variables: Record<string, unknown> = {},
  cost = 1, // number of top-level fields in `query`
): Promise<T> {
  let token = Deno.env.get('HARDCOVER_TOKEN') ?? ''
  if (!token) throw new Error('HARDCOVER_TOKEN is not set')
  if (!/^bearer /i.test(token)) token = `Bearer ${token}`

  let res: Response | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    const refilled = bucket.remaining + (Date.now() - bucket.at) / 1000
    if (refilled < cost) await sleep((cost - refilled) * 1000 + 250)
    res = await fetch(API, {
      method: 'POST',
      headers: {
        authorization: token,
        'content-type': 'application/json',
        'user-agent': 'book-tracker discovery (personal use)',
      },
      body: JSON.stringify({ query, variables }),
    })
    readRateLimit(res)
    if (res.status !== 429) break
    await res.body?.cancel()
    bucket = { remaining: 0, at: Date.now() }
    await sleep(2000 * (attempt + 1))
  }
  if (res!.status === 429) throw new Error('Hardcover rate limit reached; try again in a minute')
  res = res!
  if (res.status === 401) throw new Error('Hardcover rejected the API key (expired or revoked?)')
  const body = await res.json()
  if (!res.ok || body.errors) {
    const msg = body.errors?.[0]?.message ?? body.error ?? res.statusText
    throw new Error(`Hardcover: ${msg}`)
  }
  return body.data as T
}

// ---------- titles and dates ----------

const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// "The Wolves of War: Book Two", "Wolves of War (Book 2)" and "Wolves of War"
// are the same book here; "Red God" and "Red Goddess" are not, nor are
// "Hunger" and "Hunger Games". Subtitles and edition filler are dropped, then
// the remaining words must match exactly.
const FILLER = /\s+(a novel|novel|book \w+|vol(ume)? \w+|#\s*\d+)$/

function titleKey(title: string): string {
  let t = fold(title).split(/[:(\[]/)[0].replace(/[^a-z0-9#]+/g, ' ').trim()
  for (let prev = ''; prev !== t; ) {
    prev = t
    t = t.replace(FILLER, '').trim()
  }
  return t.replace(/^(the|a|an)\s+/, '').replace(/\s+/g, ' ')
}

function sameTitle(a: string, b: string): boolean {
  const ka = titleKey(a)
  return ka !== '' && ka === titleKey(b)
}

type Precision = 'day' | 'month' | 'year'

// Last day of the period a release date stands for (see src/lib/release.ts).
function releaseEnd(date: string, precision: Precision): string {
  const [y, m] = date.split('-').map(Number)
  if (precision === 'year') return `${y}-12-31`
  if (precision === 'month') return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return date
}

// Hardcover stores "only the year is known" as January 1st or December 31st.
function releaseOf(date: string | null, year: number | null): { date: string | null; precision: Precision } {
  if (date && /-(01-01|12-31)$/.test(date)) return { date: `${date.slice(0, 4)}-01-01`, precision: 'year' }
  if (date) return { date, precision: 'day' }
  if (year) return { date: `${year}-01-01`, precision: 'year' }
  return { date: null, precision: 'day' }
}

// ---------- actions ----------

interface SearchHit {
  document: {
    id: string
    name: string
    slug: string
    books_count: number
    books?: string[]
    alternate_names?: string[]
    image?: { url?: string }
  }
}

async function searchOnce(query: string): Promise<SearchHit[]> {
  const data = await hardcover<{ search: { results: { hits: SearchHit[] } } }>(
    `query Search($q: String!) {
      search(query: $q, query_type: "Author", per_page: 8) { results }
    }`,
    { q: query },
  )
  return data.search.results.hits ?? []
}

async function search(query: string) {
  // Hardcover's search misses "K. J. Parker" when the record says "K.J. Parker":
  // also try the initials closed up, and merge.
  const closed = query.replace(/\b([A-Za-z])\.\s+(?=[A-Za-z]\.)/g, '$1.')
  const hits = await searchOnce(query)
  if (closed !== query) {
    const seen = new Set(hits.map((h) => h.document.id))
    for (const h of await searchOnce(closed)) if (!seen.has(h.document.id)) hits.push(h)
  }
  return hits.map(({ document: d }) => ({
    id: Number(d.id),
    name: d.name,
    slug: d.slug,
    booksCount: d.books_count,
    books: (d.books ?? []).slice(0, 4),
    alternateNames: d.alternate_names ?? [],
    image: d.image?.url ?? null,
  }))
}

async function linkByGoodreads(db: SupabaseClient) {
  const { data: authors, error } = await db
    .from('authors')
    .select('id, goodreads_url')
    .eq('hardcover_status', 'unlinked')
  if (error) throw error
  const { data: taken } = await db.from('authors').select('hardcover_id').not('hardcover_id', 'is', null)
  const used = new Set((taken ?? []).map((a) => a.hardcover_id as number))

  const byGoodreads = new Map<string, number>() // goodreads author id -> our author id
  for (const a of authors ?? []) {
    const m = /\/author\/(?:show|list)\/(\d+)/.exec(a.goodreads_url ?? '')
    if (m) byGoodreads.set(m[1], a.id)
  }
  const ids = [...byGoodreads.keys()]
  let linked = 0
  for (let i = 0; i < ids.length; i += GOODREADS_CHUNK) {
    const chunk = ids.slice(i, i + GOODREADS_CHUNK)
    const data = await hardcover<{
      authors: { id: number; slug: string; identifiers: { goodreads?: string[] } }[]
    }>(
      `query ByGoodreads($where: authors_bool_exp!) {
        authors(where: $where) { id slug identifiers }
      }`,
      {
        where: {
          canonical_id: { _is_null: true },
          _or: chunk.map((g) => ({ identifiers: { _contains: { goodreads: [g] } } })),
        },
      },
    )
    // Only link when exactly one Hardcover author claims the Goodreads id.
    const claims = new Map<string, { id: number; slug: string }[]>()
    for (const hc of data.authors) {
      for (const g of hc.identifiers.goodreads ?? []) {
        if (chunk.includes(g)) claims.set(g, [...(claims.get(g) ?? []), hc])
      }
    }
    for (const [g, hcs] of claims) {
      if (hcs.length !== 1 || used.has(hcs[0].id)) continue
      const { error: upErr } = await db
        .from('authors')
        .update({ hardcover_id: hcs[0].id, hardcover_slug: hcs[0].slug, hardcover_status: 'linked' })
        .eq('id', byGoodreads.get(g)!)
      if (!upErr) {
        used.add(hcs[0].id)
        linked++
      }
    }
  }
  const remaining = (authors?.length ?? 0) - linked
  return { linked, remaining }
}

interface SeriesHit {
  document: {
    id: string
    name: string
    slug: string
    books_count: number
    author_name?: string
    books?: string[]
  }
}

async function searchSeries(query: string) {
  const data = await hardcover<{ search: { results: { hits: SeriesHit[] } } }>(
    `query SearchSeries($q: String!) {
      search(query: $q, query_type: "Series", per_page: 10) { results }
    }`,
    { q: query },
  )
  return (data.search.results.hits ?? []).map(({ document: d }) => ({
    id: Number(d.id),
    name: d.name,
    slug: d.slug,
    booksCount: d.books_count,
    authorName: d.author_name ?? null,
    books: (d.books ?? []).slice(0, 4),
  }))
}

interface HcBook {
  id: number
  title: string
  slug: string | null
  release_date: string | null
  release_year: number | null
  users_count: number
  users_read_count: number
  author_count: { aggregate: { count: number } }
  contributions?: { author_id: number }[]
  book_series?: { series_id: number }[]
}

// Future books by a set of authors or in a set of series.
interface BookFilter {
  vars: string
  match: (ids: number[]) => Record<string, unknown>
  fields: string
  bind: (ids: number[]) => Record<string, unknown>
}

const BY_AUTHORS: BookFilter = {
  vars: '$ids: [Int!]!',
  match: (ids: number[]) => ({ contributions: { author_id: { _in: ids }, contribution: { _eq: 'Author' } } }),
  fields: 'contributions(where: { author_id: { _in: $ids }, contribution: { _eq: "Author" } }) { author_id }',
  bind: (ids: number[]) => ({ ids }),
}
const BY_SERIES: BookFilter = {
  vars: '$ids: [Int!]!',
  match: (ids: number[]) => ({ book_series: { series_id: { _in: ids } } }),
  fields: 'book_series(where: { series_id: { _in: $ids } }) { series_id }',
  bind: (ids: number[]) => ({ ids }),
}

async function futureBooks(
  by: BookFilter,
  ids: number[],
  since: string,
  year: number,
): Promise<HcBook[]> {
  const base = {
    ...by.match(ids),
    canonical_id: { _is_null: true },
    compilation: { _eq: false },
    book_status_id: { _eq: 1 },
  }
  const fields = `id title slug release_date release_year users_count users_read_count
    author_count: contributions_aggregate(where: { contribution: { _eq: "Author" } }) { aggregate { count } }
    ${by.fields}`
  const data = await hardcover<{ dated: HcBook[]; undated: HcBook[] }>(
    `query Future(${by.vars}, $dated: books_bool_exp!, $undated: books_bool_exp!) {
      dated: books(where: $dated, limit: 1000) { ${fields} }
      undated: books(where: $undated, limit: 1000) { ${fields} }
    }`,
    {
      ...by.bind(ids),
      dated: {
        ...base,
        _or: [
          { release_date: { _gte: since } },
          { release_date: { _is_null: true }, release_year: { _gte: year } },
        ],
      },
      undated: {
        ...base,
        release_date: { _is_null: true },
        release_year: { _is_null: true },
        users_count: { _gte: 5 },
        users_read_count: { _lte: 10 },
      },
    },
    2, // dated + undated
  )
  // Undated books are mostly old records missing data; announced ones are
  // wanted by many and read by almost nobody.
  const announced = data.undated.filter((b) => b.users_read_count <= b.users_count * 0.1)
  return [...data.dated, ...announced].filter(isSingleWork)
}

// Not a new book by the author: anthologies (Hardcover rarely flags them as
// compilations, but they carry a crowd of authors) and box sets / omnibuses.
const PACKAGING = /\b(box(ed)?[\s-]?set|omnibus|collection|bundle|trilogy set|books?\s+\d+\s*[-–]\s*\d+)\b/i

function isSingleWork(b: HcBook): boolean {
  return b.author_count.aggregate.count <= 3 && !PACKAGING.test(b.title)
}

// Pen names are separate Hardcover authors pointing at the main one
// (Mira Grant -> Seanan McGuire); map each back to the author it belongs to.
async function withPenNames(ids: number[]): Promise<Map<number, number>> {
  const owner = new Map(ids.map((id) => [id, id]))
  const data = await hardcover<{ authors: { id: number; alias_id: number }[] }>(
    `query PenNames($ids: [Int!]!) {
      authors(where: { alias_id: { _in: $ids } }) { id alias_id }
    }`,
    { ids },
  )
  for (const a of data.authors) if (!owner.has(a.id)) owner.set(a.id, a.alias_id)
  return owner
}

// Dismissals and accepted links only matter until the book is out: released
// books are never suggested again. Drop them a month after the release period
// ends (a margin for Hardcover correcting a wrong date). Undated rows stay, and
// accepted rows stay while the book is still on the list (they drive date hints).
async function cleanUp(db: SupabaseClient, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const [{ data: old }, { data: tracked }] = await Promise.all([
    db
      .from('book_suggestions')
      .select('id, status, hardcover_book_id, release_date, date_precision')
      .in('status', ['dismissed', 'accepted'])
      .not('release_date', 'is', null)
      .lt('release_date', cutoff),
    db.from('books').select('hardcover_book_id').not('hardcover_book_id', 'is', null),
  ])
  const onList = new Set((tracked ?? []).map((b) => b.hardcover_book_id as number))
  const ids = (old ?? [])
    .filter((s) => releaseEnd(s.release_date, s.date_precision) < cutoff)
    .filter((s) => s.status === 'dismissed' || !onList.has(s.hardcover_book_id))
    .map((s) => s.id)
  for (let i = 0; i < ids.length; i += 200) {
    await db.from('book_suggestions').delete().in('id', ids.slice(i, i + 200))
  }
  return ids.length
}

interface LinkedAuthor {
  id: number
  hardcover_id: number | null
  hardcover_series: { id: number }[]
  books: { id: number; title: string; hardcover_book_id: number | null }[]
}

async function scan(db: SupabaseClient) {
  const { data, error } = await db
    .from('authors')
    .select('id, hardcover_id, hardcover_series, books(id, title, hardcover_book_id)')
    .eq('hardcover_status', 'linked')
  if (error) throw error
  const authors = (data ?? []) as LinkedAuthor[]
  const byHardcover = new Map(
    authors.filter((a) => a.hardcover_id !== null).map((a) => [a.hardcover_id!, a]),
  )
  const bySeries = new Map<number, LinkedAuthor[]>()
  for (const a of authors) {
    for (const { id } of a.hardcover_series ?? []) bySeries.set(id, [...(bySeries.get(id) ?? []), a])
  }

  const { data: existing } = await db
    .from('book_suggestions')
    .select('id, author_id, hardcover_book_id, status')
  const known = new Map((existing ?? []).map((s) => [`${s.author_id}:${s.hardcover_book_id}`, s.status]))

  // Look back two weeks so a book whose date was just reached isn't missed.
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const since = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)
  const year = now.getFullYear()
  const rows: Record<string, unknown>[] = []
  const bookLinks: { id: number; hardcover_book_id: number }[] = []
  const seen = new Set<string>() // a book found by author and by series counts once
  let fresh = 0

  const record = (author: LinkedAuthor, b: HcBook) => {
    const key = `${author.id}:${b.id}`
    if (seen.has(key)) return
    // Already tracked? Then record the link (for date hints) instead of suggesting it.
    const tracked =
      author.books.find((t) => t.hardcover_book_id === b.id) ??
      author.books.find((t) => t.hardcover_book_id === null && sameTitle(t.title, b.title))
    if (tracked && tracked.hardcover_book_id === null) {
      bookLinks.push({ id: tracked.id, hardcover_book_id: b.id })
      tracked.hardcover_book_id = b.id
    }
    const release = releaseOf(b.release_date, b.release_year)
    // Already out: worth refreshing a tracked book's date, but not suggesting
    // (and a pending suggestion for it is pruned below, as it isn't `seen`).
    const released = release.date !== null && releaseEnd(release.date, release.precision) < today
    if (!tracked && released && (known.get(key) ?? 'new') === 'new') return
    seen.add(key)
    // A pending suggestion you've since added by hand becomes a link, not a duplicate.
    const prior = known.get(key)
    const status = tracked && prior !== 'dismissed' ? 'accepted' : (prior ?? 'new')
    if (!known.has(key) && status === 'new') fresh++
    known.set(key, status)
    rows.push({
      author_id: author.id,
      hardcover_book_id: b.id,
      title: b.title,
      release_date: release.date,
      date_precision: release.precision,
      hardcover_slug: b.slug,
      readers: b.users_count,
      status,
      updated_at: now.toISOString(),
    })
  }

  const ids = [...byHardcover.keys()]
  for (let i = 0; i < ids.length; i += AUTHOR_CHUNK) {
    const owner = await withPenNames(ids.slice(i, i + AUTHOR_CHUNK))
    for (const b of await futureBooks(BY_AUTHORS, [...owner.keys()], since, year)) {
      // One suggestion per (our author, book), even if two of their names wrote it.
      for (const c of b.contributions ?? []) {
        const author = byHardcover.get(owner.get(c.author_id)!)
        if (author) record(author, b)
      }
    }
  }

  const seriesIds = [...bySeries.keys()]
  for (let i = 0; i < seriesIds.length; i += SERIES_CHUNK) {
    for (const b of await futureBooks(BY_SERIES, seriesIds.slice(i, i + SERIES_CHUNK), since, year)) {
      for (const { series_id } of b.book_series ?? []) {
        for (const author of bySeries.get(series_id) ?? []) record(author, b)
      }
    }
  }

  for (const link of bookLinks) {
    await db.from('books').update({ hardcover_book_id: link.hardcover_book_id }).eq('id', link.id)
  }
  if (rows.length) {
    const { error: upErr } = await db
      .from('book_suggestions')
      .upsert(rows, { onConflict: 'author_id,hardcover_book_id' })
    if (upErr) throw upErr
  }
  // Pending suggestions that no longer qualify (released, filtered out, gone
  // from Hardcover) leave the inbox; accepted and dismissed ones are kept.
  const stale = (existing ?? [])
    .filter((s) => s.status === 'new' && !seen.has(`${s.author_id}:${s.hardcover_book_id}`))
    .map((s) => s.id)
  for (let i = 0; i < stale.length; i += 200) {
    await db.from('book_suggestions').delete().in('id', stale.slice(i, i + 200))
  }
  const cleaned = await cleanUp(db, now)
  const result = {
    checkedAt: now.toISOString(),
    authors: authors.length,
    books: rows.length,
    new: fresh,
    cleaned,
  }
  await db.from('app_state').upsert({ key: 'hardcover_scan', value: result, updated_at: result.checkedAt })
  return result
}

// ---------- entry ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))

    switch (body.action) {
      case 'search':
        if (typeof body.query !== 'string' || !body.query.trim()) return json({ error: 'query required' }, 400)
        return json({
          candidates:
            body.type === 'series' ? await searchSeries(body.query.trim()) : await search(body.query.trim()),
        })
      case 'link-goodreads':
        return json(await linkByGoodreads(db))
      case 'link': {
        const { error } = await db
          .from('authors')
          .update({ hardcover_id: body.hardcoverId, hardcover_slug: body.slug ?? null, hardcover_status: 'linked' })
          .eq('id', body.authorId)
        if (error) {
          return json({ error: error.code === '23505' ? 'Another author is already linked to that Hardcover author.' : error.message }, 400)
        }
        return json({ ok: true })
      }
      case 'link-series': {
        const series = Array.isArray(body.series)
          ? body.series.map((x: { id: number; name: string; slug: string }) => ({
              id: Number(x.id),
              name: String(x.name),
              slug: String(x.slug ?? ''),
            }))
          : []
        const { data: current } = await db.from('authors').select('hardcover_id').eq('id', body.authorId).single()
        const { error } = await db
          .from('authors')
          .update({
            hardcover_series: series,
            hardcover_status: series.length || current?.hardcover_id ? 'linked' : 'unlinked',
          })
          .eq('id', body.authorId)
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true })
      }
      case 'skip':
      case 'unlink': {
        const { error } = await db
          .from('authors')
          .update({
            hardcover_id: null,
            hardcover_slug: null,
            hardcover_series: [],
            hardcover_status: body.action === 'skip' ? 'skipped' : 'unlinked',
          })
          .eq('id', body.authorId)
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true })
      }
      case 'scan':
        return json(await scan(db))
      default:
        return json({ error: `unknown action: ${body.action}` }, 400)
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
