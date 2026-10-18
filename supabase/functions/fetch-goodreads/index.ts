
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.102.1'
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.5.0'

type Shelf = 'read' | 'currently-reading'

interface RawItem {
  book_id?: string | number
  title?: string
  author_name?: string
  user_rating?: string | number
  user_review?: string
  book_image_url?: string
  book_large_image_url?: string
  link?: string
  user_read_at?: string
  user_date_added?: string
}

interface ParsedRss {
  rss?: { channel?: { item?: RawItem | RawItem[] } }
}

function toDate(value: string | undefined): string | null {
  if (!value) return null
  const t = Date.parse(value)
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

function stripHtml(value: string | undefined): string | null {
  if (!value) return null
  const text = value.replace(/<[^>]*>/g, '').trim()
  return text || null
}

async function fetchShelf(grUserId: string, rssKey: string, shelf: Shelf) {
  const url = `https://www.goodreads.com/review/list_rss/${grUserId}?key=${encodeURIComponent(rssKey)}&shelf=${shelf}`
  const res = await fetch(url, { headers: { 'User-Agent': 'book-tracker/1.0' } })
  if (!res.ok) throw new Error(`Goodreads ${shelf} fetch failed: ${res.status}`)
  const xml = await res.text()

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
    trimValues: true,
  })
  const parsed = parser.parse(xml) as ParsedRss
  const raw = parsed.rss?.channel?.item
  const items: RawItem[] = !raw ? [] : Array.isArray(raw) ? raw : [raw]

  return items
    .filter((it) => it.book_id != null)
    .map((it) => {
      const rating = Number(it.user_rating)
      return {
        goodreads_book_id: String(it.book_id),
        title: String(it.title ?? '').trim() || '(untitled)',
        author: it.author_name ? String(it.author_name) : null,
        shelf,
        rating: Number.isFinite(rating) ? rating : 0,
        review: stripHtml(it.user_review),
        image_url: it.book_large_image_url || it.book_image_url || null,
        link: it.link ?? null,
        date_read: toDate(it.user_read_at),
        date_added: toDate(it.user_date_added),
      }
    })
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Identify the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...cors, 'content-type': 'application/json' },
      })
    }

    // Service client to read credentials and upsert (bypasses RLS).
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: cred, error: credErr } = await admin
      .from('gr_credentials')
      .select('gr_user_id, rss_key')
      .eq('user_id', user.id)
      .single()

    if (credErr || !cred) {
      return new Response(
        JSON.stringify({ error: 'no goodreads credentials on file' }),
        { status: 400, headers: { ...cors, 'content-type': 'application/json' } },
      )
    }

    const shelves: Shelf[] = ['read', 'currently-reading']
    const allRows: Array<Record<string, unknown>> = []
    const counts: Record<string, number> = {}
    for (const shelf of shelves) {
      const rows = await fetchShelf(cred.gr_user_id, cred.rss_key, shelf)
      counts[shelf] = rows.length
      for (const r of rows) allRows.push({ ...r, user_id: user.id })
    }

    // Wipe and replace this user's cache so removed books disappear.
    await admin.from('gr_items').delete().eq('user_id', user.id)
    if (allRows.length > 0) {
      const { error: insErr } = await admin.from('gr_items').insert(allRows)
      if (insErr) throw insErr
    }

    return new Response(JSON.stringify({ ok: true, counts }), {
      headers: { ...cors, 'content-type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  }
})
