import { ArrowDown, CalendarDays } from 'lucide-react'
import { SafeImage } from './SafeImage'

type Props = { onBook: () => void; dailyMessage: string }

export function Hero({ onBook, dailyMessage }: Props) {
  return (
    <section id="top" className="hero section-pad">
      <div className="hero-copy">
        <span className="eyebrow">BATANGAS • NATURE-FIRST STAY</span>
        <h1>A softer place to <em>stay awhile.</em></h1>
        <p className="hero-lede">Slow mornings, green views, and a campsite made for people who want less noise and more room to breathe.</p>
        <div className="hero-actions">
          <button className="button button-primary" onClick={onBook}><CalendarDays size={17} /> Check availability</button>
          <a className="button button-quiet" href="#stays">Explore stays <ArrowDown size={16} /></a>
        </div>
        <div className="hero-notes">
          <span>Flexible stays</span><span>Nature-led setting</span><span>Guest support</span>
        </div>
      </div>
      <div className="hero-visual" aria-label="Malaya Campsite featured view">
        <div className="image-frame hero-image">
          <SafeImage src="/images/hero.webp" alt="Malaya Campsite landscape" />
          <video
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/images/hero.webp"
            aria-hidden="true"
            onLoadedData={(event) => event.currentTarget.classList.add('is-ready')}
          >
            <source src="/videos/malaya-hero-mobile.mp4?v=3" type="video/mp4" media="(max-width: 767px)" />
            <source src="/videos/malaya-hero.mp4?v=3" type="video/mp4" />
          </video>
        </div>
        <div className="hero-card">
          <span className="mini-label">TODAY AT MALAYA</span>
          <p>“{dailyMessage}”</p>
        </div>
      </div>
    </section>
  )
}
