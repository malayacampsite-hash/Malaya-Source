import { useState } from 'react'
import { Menu, X } from 'lucide-react'

type Props = { onBook: () => void }

export function Header({ onBook }: Props) {
  const [open, setOpen] = useState(false)
  const scrollTo = (id: string) => {
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Malaya Campsite home"><img src="/images/logo.png" alt="Malaya Campsite" /></a>
      <nav className="header-nav" aria-label="Primary navigation">
        <button onClick={() => scrollTo('home')}>Home</button>
        <button onClick={() => scrollTo('stay')}>The cabins</button>
        <button onClick={() => scrollTo('inclusions')}>Inclusions</button>
        <button onClick={() => scrollTo('location')}>Location</button>
        <button onClick={() => scrollTo('faqs')}>FAQs</button>
      </nav>
      <button className="header-book" onClick={onBook}>Book your stay</button>
      <button className="mobile-menu" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Menu">{open ? <X size={20} /> : <Menu size={20} />}</button>
      {open ? <div className="mobile-nav"><button onClick={() => scrollTo('home')}>Home</button><button onClick={() => scrollTo('stay')}>The cabins</button><button onClick={() => scrollTo('inclusions')}>Inclusions</button><button onClick={() => scrollTo('location')}>Location</button><button onClick={() => scrollTo('faqs')}>FAQs</button><button className="mobile-nav-book" onClick={() => { setOpen(false); onBook() }}>Book your stay</button></div> : null}
    </header>
  )
}
