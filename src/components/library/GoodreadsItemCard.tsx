import { useState } from 'react'
import { Star } from '@phosphor-icons/react'
import type { GrItem } from '../../lib/types'

function Stars({ rating }: { rating: number }) {
  if (!rating) return <span className="rating-none">unrated</span>
  return (
    <span className="rating" role="img" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) =>
        n <= rating ? (
          <Star key={n} weight="fill" className="rating-filled" />
        ) : (
          <Star key={n} weight="light" className="rating-empty" />
        ),
      )}
    </span>
  )
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Reviews longer than this are clamped to four lines with a More toggle.
const LONG_REVIEW = 260

export function GoodreadsItemCard({ item }: { item: GrItem }) {
  const read = formatDate(item.date_read)
  const [expanded, setExpanded] = useState(false)
  const long = (item.review?.length ?? 0) > LONG_REVIEW
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
        {item.review && (
          <>
            <p className={`gr-review ${expanded ? 'gr-review-open' : ''}`}>{item.review}</p>
            {long && (
              <button className="gr-review-toggle" onClick={() => setExpanded((e) => !e)}>
                {expanded ? 'Less' : 'More'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
