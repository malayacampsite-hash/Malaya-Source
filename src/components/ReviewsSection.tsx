import { useEffect, useState } from 'react'
import { ArrowRight, Star } from 'lucide-react'
import type { SiteReview } from '../types'
import { listPublishedReviews } from '../services/supabase'

export function ReviewsSection() {
  const [reviews, setReviews] = useState<SiteReview[]>([])

  useEffect(() => {
    let mounted = true
    void listPublishedReviews(6)
      .then(items => { if (mounted) setReviews(items) })
      .catch(() => undefined)
    return () => { mounted = false }
  }, [])

  return (
    <section id="reviews" className="reviews-block shell-wide">
      <div className="reviews-heading">
        <div>
          <p className="eyebrow">05 / GUEST STORIES</p>
          <h2>Mga kwentong Malaya.</h2>
        </div>
        <a href="https://www.facebook.com/batangascampsite/" target="_blank" rel="noreferrer" className="text-link">
          More reviews on Facebook <ArrowRight size={15} />
        </a>
      </div>

      {reviews.length ? (
        <div className="reviews-grid">
          {reviews.map(review => (
            <article className="review-card" key={review.id}>
              {review.photo_data ? (
                <div className="review-photo-wrap">
                  <img
                    className="review-photo"
                    src={`data:image/webp;base64,${review.photo_data}`}
                    alt={`Guest photo shared by ${review.full_name}`}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="review-photo-placeholder">
                  <span className="eyebrow">GUEST PHOTO</span>
                </div>
              )}

              <div className="review-card-body">
                <div className="review-photo-label">Guest photo</div>
                <div className="review-rating" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={13} fill={index < review.rating ? 'currentColor' : 'none'} />
                  ))}
                </div>
                <blockquote>{review.review_text}</blockquote>
                <div className="review-author">{review.full_name}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="reviews-empty">
          <span className="eyebrow">YOUR STORY COULD BE NEXT</span>
          <p>Reviews submitted after a stay will appear here.</p>
        </div>
      )}
    </section>
  )
}
