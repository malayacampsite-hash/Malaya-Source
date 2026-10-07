import { SectionHeading } from './SectionHeading'
import { SafeImage } from './SafeImage'

const gallery = [
  ['/images/gallery-01.jpg', 'Green mornings'],
  ['/images/gallery-02.jpg', 'The campsite'],
  ['/images/gallery-03.jpg', 'Room details'],
  ['/images/gallery-04.jpg', 'Open air'],
  ['/images/gallery-05.jpg', 'Slow afternoons'],
]

export function Gallery() {
  return (
    <section id="gallery" className="section-pad gallery-section">
      <SectionHeading eyebrow="A GLIMPSE OF MALAYA" title="The place should do most of the talking." children="Use the campsite's own photography here so the visual language feels honest, specific, and unmistakably Malaya." />
      <div className="gallery-grid">
        {gallery.map(([src, alt], index) => (
          <figure key={src} className={`gallery-item gallery-${index + 1}`}>
            <SafeImage src={src} alt={alt} />
            <figcaption>{alt}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
