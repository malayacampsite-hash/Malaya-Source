import { Leaf, MapPin } from 'lucide-react'

export function Footer() {
  return <footer id="contact" className="footer section-pad">
    <div className="footer-main">
      <div><div className="footer-brand"><span className="brand-mark"><Leaf size={17} /></span><strong>Malaya Campsite</strong></div><p>Nature-led stays in Batangas, designed for slower days.</p></div>
      <div className="footer-contact"><a href="#contact"><MapPin size={16} /> Batangas, Philippines</a></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Malaya Campsite</span><span>Booking & guest support available online</span></div>
  </footer>
}
