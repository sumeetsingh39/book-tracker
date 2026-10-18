import type { Book, DatePrecision } from './types'

// What the page shows for a book. Only 'overdue' is stored; the rest follows
// from the date: 'due' once the release period has passed (check whether it's
// available, then remove it or mark it overdue), 'unknown' with no date yet.
export type DisplayStatus = 'upcoming' | 'due' | 'overdue' | 'unknown'

export type Bucket = 'due' | 'overdue' | 'this-month' | 'soon' | 'later' | 'unknown'

export const BUCKETS: { value: Bucket; label: string }[] = [
  { value: 'due', label: 'Due now' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'this-month', label: 'This month' },
  { value: 'soon', label: 'Next three months' },
  { value: 'later', label: 'Later' },
  { value: 'unknown', label: 'Date unknown' },
]

const pad = (n: number) => String(n).padStart(2, '0')

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today(): string {
  return isoDay(new Date())
}

// Last day of the period a release date stands for, as YYYY-MM-DD.
export function releaseEnd(date: string, precision: DatePrecision): string {
  const [y, m] = date.split('-').map(Number)
  if (precision === 'year') return `${y}-12-31`
  if (precision === 'month') return isoDay(new Date(y, m, 0))
  return date
}

export function displayStatus(book: Book, now = today()): DisplayStatus {
  if (book.status === 'overdue') return 'overdue'
  if (!book.release_date) return 'unknown'
  return releaseEnd(book.release_date, book.date_precision) < now ? 'due' : 'upcoming'
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  upcoming: 'Upcoming',
  due: 'Due',
  overdue: 'Overdue',
  unknown: 'No date',
}

export function bucketOf(book: Book, now = today()): Bucket {
  const status = displayStatus(book, now)
  if (status !== 'upcoming') return status
  const end = releaseEnd(book.release_date!, book.date_precision)
  const [y, m] = now.split('-').map(Number)
  if (end <= isoDay(new Date(y, m, 0))) return 'this-month'
  if (end <= isoDay(new Date(y, m + 3, 0))) return 'soon'
  return 'later'
}

// Sort key: books with a known date by the end of their period, then undated.
export function releaseSortKey(book: Book): string {
  return book.release_date ? releaseEnd(book.release_date, book.date_precision) : '9999-12-31'
}

export function formatRelease(date: string | null, precision: DatePrecision): string {
  if (!date) return 'Date TBA'
  const d = new Date(date + 'T00:00:00')
  if (precision === 'year') return String(d.getFullYear())
  if (precision === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
