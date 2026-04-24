import type { GrItem } from '../../lib/types'

function Stars({ rating }: { rating: number }) {
  if (!rating) return <span className="rating-none">unrated</span>
  const filled = '★'.repeat(rating)
  const empty = '☆'.repeat(5 - rating)
  return (
    <span className="rating" aria-label={`${rating} of 5 stars`}>
      <span className="rating-filled">{filled}</span>
      <span className="rating-empty">{empty}</span>
    </span>
  )
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function GoodreadsItemCard({ item }: { item: GrItem }) {
  const read = formatDate(item.date_read)
  return (
    <div className="gr-card">
      {item.image_url ? (
        <img className="gr-cover" src={item.image_url} alt={item.title} loading="lazy" />
      ) : (
        <div className="gr-cover gr-cover-placeholder" />
      )}
      <div className="gr-meta">
        <div className="gr-title-row">
          {item.link ? (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="gr-title">
              {item.title}
            </a>
          ) : (
            <span className="gr-title">{item.title}</span>
          )}
        </div>
        {item.author && <div className="gr-author">{item.author}</div>}
        <div className="gr-row">
          <Stars rating={item.rating} />
          {read && <span className="gr-date">Read {read}</span>}
        </div>
        {item.review && <p className="gr-review">{item.review}</p>}
      </div>
    </div>
  )
}
