import { ArrowUpRight, Users } from 'lucide-react'
import type { Accommodation } from '../types'
import { SectionHeading } from './SectionHeading'
import { SafeImage } from './SafeImage'

type Props = { stays: Accommodation[]; onBook: (stayId?: string) => void }

export function Stays({ stays, onBook }: Props) {
  return (
    <section id="stays" className="section-pad stays">
      <SectionHeading eyebrow="STAY YOUR WAY" title="Choose a space that fits the trip." children="Rates shown are starting references for the draft experience and can be connected to the campsite's live pricing later." />
      <div className="stay-grid">
        {stays.map((stay, index) => (
          <article className={`stay-card ${index === 1 ? 'stay-featured' : ''}`} key={stay.id}>
            <div className="image-frame stay-image"><SafeImage src={stay.image} alt={stay.name} /></div>
            <div className="stay-content">
              <div className="stay-topline"><span>{String(index + 1).padStart(2, '0')}</span><span>{stay.priceLabel}</span></div>
              <h3>{stay.name}</h3>
              <p>{stay.shortDescription}</p>
              <div className="feature-list">
                {stay.features.map((feature) => <span key={feature}>{feature}</span>)}
              </div>
              <button className="text-action" onClick={() => onBook(stay.id)}>Book this stay <ArrowUpRight size={15} /></button>
            </div>
            <div className="capacity"><Users size={14} /> {stay.capacity} max</div>
          </article>
        ))}
      </div>
    </section>
  )
}
