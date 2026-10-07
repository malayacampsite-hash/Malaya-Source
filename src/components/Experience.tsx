import { Compass, MessageCircle, Trees } from 'lucide-react'
import { SectionHeading } from './SectionHeading'

const items = [
  { icon: Trees, title: 'Nature, first', text: 'A stay shaped around trees, open air, and an unhurried pace.' },
  { icon: Compass, title: 'Easy planning', text: 'Choose your stay and send a booking request without leaving the site.' },
  { icon: MessageCircle, title: 'Real support', text: 'Start with quick answers, then hand the conversation to staff when you need a person.' },
]

export function Experience() {
  return (
    <section id="experience" className="section-pad experience">
      <SectionHeading eyebrow="THE MALAYA WAY" title="Less itinerary. More atmosphere." children="The website is designed around the way guests actually choose a campsite: see the place, understand the stay, then make it easy to book." />
      <div className="experience-grid">
        {items.map(({ icon: Icon, title, text }) => (
          <article className="experience-card" key={title}>
            <div className="icon-box"><Icon size={20} strokeWidth={1.7} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
