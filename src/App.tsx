import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, ChevronRight, Clock3, Coffee, ExternalLink, Flame, Gamepad2, MapPin, MessageCircle, PawPrint, Trees, Utensils, Users } from 'lucide-react'
import { Header } from './components/Header'
import { BookingModal } from './components/BookingModal'
import { SupportWidget } from './components/SupportWidget'
import { SafeImage } from './components/SafeImage'
import { accommodation, activities, dailyMessage } from './data/siteContent'
import { getSiteSetting } from './services/supabase'

export default function App() {
  const [bookingOpen, setBookingOpen] = useState(false)
  const [presetStay, setPresetStay] = useState<string | undefined>(undefined)
  const [supportOpen, setSupportOpen] = useState(false)
  const [daily, setDaily] = useState(dailyMessage)

  useEffect(() => {
    void getSiteSetting('daily_message')
      .then(value => { if (value) setDaily(value) })
      .catch(() => undefined)
  }, [])

  const openBooking = (stayId?: string) => {
    setPresetStay(stayId)
    setBookingOpen(true)
  }

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="site-shell">
      <Header onBook={() => openBooking()} />

      <main id="home">
        <section className="hero-cinematic">
          <div className="hero-photo">
            <SafeImage src="/images/hero.webp" alt="Malaya Campsite bamboo cabin exterior" priority />
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
          <div className="hero-overlay" />
          <div className="hero-content shell-wide">
            <div className="hero-kicker"><span /> Nasugbu, Batangas</div>
            <h1>Come for the quiet.<br /><em>Stay for the feeling.</em></h1>
            <p>Malaya Campsite is a nature-first escape built around a simple idea: give people more room to slow down.</p>
            <div className="hero-actions">
              <button className="button button-light" onClick={() => openBooking()}><CalendarDays size={17} /> Check dates</button>
              <button className="hero-link" onClick={() => scrollTo('stay')}><span>See the cabin</span><ArrowRight size={16} /></button>
            </div>
          </div>
          <div className="hero-note">
            <span className="eyebrow eyebrow-light">TODAY AT MALAYA</span>
            <strong>{daily}</strong>
          </div>
          <div className="hero-meta">
            <span>22-hour stay</span><span>Breakfast included</span><span>Pet-friendly</span>
          </div>
        </section>

        <section className="intro-block shell">
          <div className="section-rail"><span>01</span><span>THE PLACE</span></div>
          <div className="intro-copy">
            <p className="eyebrow">A QUIETER KIND OF GETAWAY</p>
            <h2>Wake up with bamboo above you and green all around.</h2>
            <p className="lead">The campsite experience is deliberately uncomplicated. Settle into a private cabin, make coffee, gather around a bonfire, play a few games, and let the outdoors set the pace.</p>
          </div>
          <div className="intro-side">
            <div className="line-stat"><strong>01</strong><span>private cabin</span></div>
            <div className="line-stat"><strong>22h</strong><span>stay rhythm</span></div>
            <div className="line-stat"><strong>∞</strong><span>Kapeng Barako</span></div>
          </div>
        </section>

        <section id="stay" className="stay-feature shell-wide">
          <div className="stay-photo tall-photo">
            <SafeImage src="/images/cabin-interior.webp" alt="Kanlungan Cabin interior with bed and bamboo walls" />
            <span className="photo-label">KANLUNGAN CABIN</span>
          </div>
          <div className="stay-copy">
            <div className="section-rail"><span>02</span><span>STAY</span></div>
            <p className="eyebrow">YOUR BASE AT MALAYA</p>
            <h2>{accommodation[0].name}</h2>
            <p className="lead">{accommodation[0].shortDescription}</p>
            <div className="stay-facts">
              <div><Users size={16} /><span>Up to 2 guests</span></div>
              <div><Clock3 size={16} /><span>22-hour stay</span></div>
              <div><Coffee size={16} /><span>Breakfast + Kapeng Barako</span></div>
              <div><PawPrint size={16} /><span>Pets welcome</span></div>
            </div>
            <div className="stay-cta-row">
              <button className="button button-primary" onClick={() => openBooking('kanlungan-cabin')}>Request these dates <ArrowRight size={16} /></button>
              <span className="rate-note">Rates are confirmed with the booking request.</span>
            </div>
          </div>
        </section>

        <section className="photo-break shell-wide">
          <div className="photo-break-main"><SafeImage src="/images/waterfall.webp" alt="Natural waterfall near the campsite" /></div>
          <div className="photo-break-copy">
            <p className="eyebrow">OUTSIDE THE CABIN</p>
            <h2>Make the day as full—or as empty—as you like.</h2>
            <p>Explore the water, take a horseback ride, or stay close to camp and keep things simple.</p>
            <button className="text-link" onClick={() => scrollTo('experience')}>Explore the experience <ArrowRight size={15} /></button>
          </div>
        </section>

        <section id="experience" className="experience-block shell">
          <div className="section-rail"><span>03</span><span>EXPERIENCE</span></div>
          <div className="experience-layout">
            <div className="experience-intro">
              <p className="eyebrow">WHAT A MALAYA DAY CAN HOLD</p>
              <h2>Nothing forced. Just good reasons to step outside.</h2>
            </div>
            <div className="experience-list">
              {activities.map((item, index) => (
                <article key={item.title} className="experience-row">
                  <span>0{index + 1}</span>
                  <div><h3>{item.title}</h3><p>{item.text}</p></div>
                  <ChevronRight size={17} />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="included-block shell-wide">
          <div className="included-copy">
            <p className="eyebrow">INCLUDED IN THE STAY</p>
            <h2>The practical details, already thought through.</h2>
            <p>Current public listing information describes the stay as a comfortable mix of simple campsite living and useful comforts.</p>
          </div>
          <div className="included-grid">
            {[
              [Coffee, 'Breakfast & unlimited Kapeng Barako'],
              [Utensils, 'Cooking area'],
              [Flame, 'Bonfire areas'],
              [Gamepad2, 'Games & outdoor recreation'],
              [PawPrint, 'Pet-friendly stay'],
              [Trees, 'Nature-led activities'],
            ].map(([Icon, label]) => (
              <div className="included-item" key={String(label)}><Icon size={18} /><span>{String(label)}</span></div>
            ))}
          </div>
        </section>

        <section id="gallery" className="gallery-block shell-wide">
          <div className="gallery-heading">
            <div><p className="eyebrow">04 / GALLERY</p><h2>Let the real place lead.</h2></div>
            <p>Photography supplied by Malaya Campsite. No stock imagery in the guest experience.</p>
          </div>
          <div className="gallery-mosaic">
            <figure className="gallery-large"><SafeImage src="/images/cabin-exterior.webp" alt="Malaya Campsite bamboo cabin exterior" /></figure>
            <figure><SafeImage src="/images/cabin-interior-detail.webp" alt="Bamboo cabin interior detail" /></figure>
            <figure><SafeImage src="/images/hero.webp" alt="Malaya Campsite cabin exterior under greenery" /></figure>
            <figure className="gallery-wide"><SafeImage src="/images/waterfall.webp" alt="Natural waterfall near Malaya Campsite" /></figure>
          </div>
        </section>

        <section id="booking" className="booking-band shell-wide">
          <div>
            <p className="eyebrow eyebrow-light">05 / BOOKING</p>
            <h2>Your dates.<br /><em>We’ll take it from there.</em></h2>
            <p>Send a booking request online. Your request is recorded in the Malaya Campsite backend so the team can review and confirm it.</p>
          </div>
          <div className="booking-side">
            <div className="booking-side-top"><span>Kanlungan Cabin</span><strong>Up to 2 guests</strong></div>
            <button className="button button-light" onClick={() => openBooking('kanlungan-cabin')}>Start a booking request <ArrowRight size={16} /></button>
            <small>No payment is taken at this step.</small>
          </div>
        </section>

        <section className="contact-strip shell">
          <div className="contact-item"><MapPin size={17} /><div><span className="eyebrow">LOCATION</span><strong>Nasugbu, Batangas</strong></div></div>
          <button className="contact-item contact-button" onClick={() => setSupportOpen(true)}><MessageCircle size={17} /><div><span className="eyebrow">QUESTIONS</span><strong>Talk to guest support</strong></div></button>
          <a className="contact-item" href="https://www.facebook.com/batangascampsite/" target="_blank" rel="noreferrer"><ExternalLink size={17} /><div><span className="eyebrow">SOCIAL</span><strong>Visit Facebook</strong></div></a>
        </section>

        <footer className="site-footer shell-wide">
          <div className="footer-brand"><img src="/images/logo.png" alt="Malaya Campsite" /><p>A slower stay in Nasugbu, Batangas.</p></div>
          <div className="footer-links"><button onClick={() => scrollTo('stay')}>Stay</button><button onClick={() => scrollTo('experience')}>Experience</button><button onClick={() => scrollTo('gallery')}>Gallery</button><button onClick={() => setSupportOpen(true)}>Support</button></div>
          <div className="footer-bottom"><span>© {new Date().getFullYear()} Malaya Campsite</span><a href="/admin">Staff access</a></div>
        </footer>
      </main>

      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} stays={accommodation} presetStay={presetStay} />
      <SupportWidget open={supportOpen} onToggle={() => setSupportOpen(v => !v)} />
    </div>
  )
}
