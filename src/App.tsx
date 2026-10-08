import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Coffee,
  ExternalLink,
  Flame,
  Gamepad2,
  MapPin,
  MessageCircle,
  PawPrint,
  Plus,
  Trees,
  Utensils,
  Users,
} from 'lucide-react'
import { Header } from './components/Header'
import { BookingModal } from './components/BookingModal'
import { SupportWidget } from './components/SupportWidget'
import { SafeImage } from './components/SafeImage'
import { ReviewsSection } from './components/ReviewsSection'
import { accommodation, dailyMessage, faq } from './data/siteContent'
import { getSiteSetting } from './services/supabase'

const guideItems = [
  ['What to bring', 'Pack light for a simple province-style stay. Message the team for the latest checklist before you travel.'],
  ['Parking & access', 'Access details can change with site conditions. Contact Malaya before your trip for the current route and parking guidance.'],
  ['Facilities & house rules', 'The stay is intentionally simple. Please follow the campsite rules and leave shared spaces ready for the next guest.'],
  ['Payments & changes', 'Your online request does not take payment. The Malaya team confirms the reservation and can guide you through any changes.'],
]

export default function App() {
  const [bookingOpen, setBookingOpen] = useState(false)
  const [presetStay, setPresetStay] = useState<string | undefined>(undefined)
  const [supportOpen, setSupportOpen] = useState(false)
  const [daily, setDaily] = useState(dailyMessage)
  const [openGuide, setOpenGuide] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  useEffect(() => {
    void getSiteSetting('daily_message')
      .then(value => { if (value) setDaily(value) })
      .catch(() => undefined)
  }, [])

  const openBooking = (stayId?: string) => {
    setPresetStay(stayId)
    setBookingOpen(true)
  }

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

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
              onLoadedData={event => event.currentTarget.classList.add('is-ready')}
            >
              <source src="/videos/malaya-hero-mobile.mp4?v=4" type="video/mp4" media="(max-width: 767px)" />
              <source src="/videos/malaya-hero.mp4?v=4" type="video/mp4" />
            </video>
          </div>
          <div className="hero-overlay" />
          <div className="hero-content shell-wide">
            <div className="hero-kicker"><span /> NASUGBU, BATANGAS</div>
            <h1>You don’t have to keep up<br />with the world today.</h1>
            <p>Traditional province-style camping. A slow living escape.</p>
            <div className="hero-actions">
              <button className="button button-light" onClick={() => scrollTo('malaya-story')}><span className="play-dot">▶</span> Silipin ang Malaya</button>
            </div>
            <div className="hero-rate"><strong>From ₱999 for 2 guests</strong><span>22-hour stay · Nasugbu, Batangas</span></div>
          </div>
          <div className="hero-note"><span className="eyebrow eyebrow-light">TODAY AT MALAYA</span><strong>{daily}</strong></div>
        </section>

        <section className="availability-bar shell-wide">
          <button onClick={() => openBooking()}><span>Check-in</span><strong>Select date</strong></button>
          <button onClick={() => openBooking()}><span>Check-out</span><strong>Select date</strong></button>
          <button onClick={() => openBooking()}><span>Guests</span><strong>2 guests</strong></button>
          <button className="availability-submit" onClick={() => openBooking()}>Check availability <ArrowRight size={15} /></button>
        </section>

        <section id="malaya-story" className="art-section shell">
          <div className="section-rail"><span>01</span><span>THE ART OF DOING NOTHING</span></div>
          <div className="art-grid">
            <figure><SafeImage src="/images/hero.webp" alt="Green view from Malaya Campsite" /><figcaption>Kape, walang minamadali.</figcaption></figure>
            <figure><SafeImage src="/images/waterfall.webp" alt="Nature around Malaya Campsite" /><figcaption>Umupo. Tumingin. Huminga.</figcaption></figure>
            <figure><SafeImage src="/images/cabin-interior-detail.webp" alt="Bed inside a bamboo cabin" /><figcaption>Matulog buong hapon.</figcaption></figure>
          </div>
        </section>

        <section id="stay" className="cabins-section shell-wide">
          <div className="cabins-heading">
            <div><p className="eyebrow">02 / THE CABINS</p><h2>Simpleng tuluyan mo.</h2></div>
            <span>From ₱999 for 2 guests · 22-hour stay</span>
          </div>
          <div className="cabins-grid">
            <article><div className="cabin-photo"><SafeImage src="/images/cabin-exterior.webp" alt="Tahanan bamboo cabin" /></div><div className="cabin-caption"><strong>Tahanan</strong><button onClick={() => openBooking('kanlungan-cabin')}>View rate <ArrowRight size={13} /></button></div></article>
            <article className="featured"><div className="cabin-photo"><SafeImage src="/images/cabin-interior.webp" alt="Kanlungan Cabin" /></div><div className="cabin-caption"><strong>Kanlungan</strong><button onClick={() => openBooking('kanlungan-cabin')}>View rate <ArrowRight size={13} /></button></div></article>
            <article><div className="cabin-photo"><SafeImage src="/images/cabin-interior-detail.webp" alt="Family hut interior" /></div><div className="cabin-caption"><strong>Family hut</strong><button onClick={() => openBooking('kanlungan-cabin')}>View rate <ArrowRight size={13} /></button></div></article>
          </div>
        </section>

        <section className="booking-inline shell-wide">
          <div className="booking-inline-main">
            <p className="eyebrow">03 / BOOKING</p>
            <h2>Simula ng pahinga mo</h2>
            <p>Choose dates to see available cabins.</p>
            <div className="inline-date-row">
              <button onClick={() => openBooking()}><span>Check-in</span><strong>Select date</strong></button>
              <button onClick={() => openBooking()}><span>Check-out</span><strong>Select date</strong></button>
              <button onClick={() => openBooking()}><span>Guests</span><strong>2 guests</strong></button>
            </div>
            <button className="button button-primary" onClick={() => openBooking('kanlungan-cabin')}>Review booking <ArrowRight size={15} /></button>
          </div>
          <div className="booking-inline-form">
            <label>Selected cabin<select defaultValue=""><option value="">Select a cabin</option><option value="kanlungan-cabin">Kanlungan Cabin</option></select></label>
            <label>Full name<input placeholder="Your full name" readOnly /></label>
            <label>Mobile number<input placeholder="09XX XXX XXXX" readOnly /></label>
            <label>Email<input placeholder="your@email.com" readOnly /></label>
            <div className="booking-form-caption">Your information is entered securely in the booking request window.</div>
          </div>
        </section>

        <section className="included-block shell-wide" id="inclusions">
          <div className="included-copy"><p className="eyebrow">04 / INCLUSIONS</p><h2>Kasama sa pahinga mo.</h2><p>Simple comforts to make the stay easier, without taking away from the outdoors.</p></div>
          <div className="included-grid">
            {[
              [Coffee, 'Coffee'], [Utensils, 'Beddings & towels'], [Flame, 'Basic celebration setup'], [Trees, 'Drinking water'], [Gamepad2, 'Electricity'], [PawPrint, 'Kitchen tools'],
            ].map(([Icon, label]) => <div className="included-item" key={String(label)}><Icon size={18} /><span>{String(label)}</span></div>)}
          </div>
        </section>

        <ReviewsSection />

        <section className="malaya-editorial shell-wide">
          <div className="editorial-heading">
            <div>
              <p className="eyebrow">06 / THE MALAYA WAY</p>
              <h2>Malaya is not a resort.</h2>
              <p className="editorial-kicker">And we don’t want to be.</p>
            </div>
            <a className="text-link text-link-dark" href="#gallery">View more photos <ArrowRight size={14} /></a>
          </div>
          <div className="editorial-grid">
            <figure className="editorial-large">
              <SafeImage src="/images/hero.webp" alt="The green landscape surrounding Malaya Campsite" />
            </figure>
            <div className="editorial-stack">
              <figure><SafeImage src="/images/cabin-interior-detail.webp" alt="Bamboo cabin interior detail" /></figure>
              <figure><SafeImage src="/images/waterfall.webp" alt="Nature around Malaya Campsite" /></figure>
            </div>
          </div>
          <div className="editorial-caption">
            <p>For you: quiet mornings, stargazing & simple living.</p>
            <span>Expect bugs, shared restrooms & limited signal. No aircon.</span>
          </div>
        </section>

        <section id="location" className="guide-location shell">
          <div className="guide-column">
            <p className="eyebrow">07 / BAGO BUMIYAHE.</p><h2>Bago bumiyahe.</h2>
            <div className="accordion-list">{guideItems.map(([title, answer]) => <div key={title} className="accordion-row"><button onClick={() => setOpenGuide(openGuide === title ? null : title)}><span>{title}</span><Plus size={15} className={openGuide === title ? 'rotate' : ''} /></button>{openGuide === title ? <p>{answer}</p> : null}</div>)}</div>
          </div>
          <div className="location-column"><p className="eyebrow">LOCATION</p><h3>Pulo, Brgy. Kaylaway,<br />Nasugbu, Batangas</h3><div className="map-placeholder"><MapPin size={22} /><span>Location map</span></div><div className="map-actions"><a href="https://www.google.com/maps/search/?api=1&query=Pulo%2C%20Brgy.%20Kaylaway%2C%20Nasugbu%2C%20Batangas" target="_blank" rel="noreferrer">Google Maps</a><a href="https://www.waze.com/ul?q=Pulo%2C%20Brgy.%20Kaylaway%2C%20Nasugbu%2C%20Batangas&navigate=yes" target="_blank" rel="noreferrer">Waze</a></div></div>
        </section>

        <section id="faqs" className="faq-block shell">
          <p className="eyebrow">08 / FAQS</p><h2>Frequently asked questions.</h2>
          <div className="faq-grid">{faq.slice(0, 3).map(item => <div className="faq-item" key={item.q}><button onClick={() => setOpenFaq(openFaq === item.q ? null : item.q)}><span>{item.q}</span><Plus size={15} className={openFaq === item.q ? 'rotate' : ''} /></button>{openFaq === item.q ? <p>{item.a}</p> : null}</div>)}</div>
        </section>

        <section className="final-cta shell-wide"><div><p className="eyebrow eyebrow-light">09 / COME AS YOU ARE</p><h2>You don’t have to<br />earn your rest.</h2><p>Dito, pwedeng-pwede magpahinga.</p><button className="button button-light" onClick={() => openBooking()}>Check available dates <ArrowRight size={15} /></button></div><div className="final-cta-image"><SafeImage src="/images/waterfall.webp" alt="Nature near Malaya Campsite" /></div></section>

        <section id="contact" className="contact-strip shell">
          <div className="contact-item"><MapPin size={17} /><div><span className="eyebrow">LOCATION</span><strong>Pulo, Brgy. Kaylaway, Nasugbu, Batangas</strong></div></div>
          <button className="contact-item contact-button" onClick={() => setSupportOpen(true)}><MessageCircle size={17} /><div><span className="eyebrow">MESSAGE US</span><strong>Guest support</strong></div></button>
          <a className="contact-item" href="mailto:malayacampsite@gmail.com"><ExternalLink size={17} /><div><span className="eyebrow">EMAIL</span><strong>malayacampsite@gmail.com</strong></div></a>
        </section>

        <footer className="site-footer shell-wide">
          <div className="footer-brand"><img src="/images/logo.png" alt="Malaya Campsite" /></div>
          <div className="footer-links"><a href="https://www.facebook.com/batangascampsite/" target="_blank" rel="noreferrer">Facebook</a><a href="#">TikTok</a><button onClick={() => setSupportOpen(true)}>Message us</button><a href="#">Booking policies</a></div>
          <div className="footer-bottom"><span>© {new Date().getFullYear()} Malaya Campsite</span><a href="/admin">Staff access</a></div>
        </footer>
      </main>

      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} stays={accommodation} presetStay={presetStay} />
      <SupportWidget open={supportOpen} onToggle={() => setSupportOpen(value => !value)} />
    </div>
  )
}
