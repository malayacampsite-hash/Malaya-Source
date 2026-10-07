import { useState } from 'react'

type Props = { src: string; alt: string; priority?: boolean }

export function SafeImage({ src, alt, priority = false }: Props) {
  const [failed, setFailed] = useState(false)
  return failed
    ? <div className="safe-image safe-image-fallback" role="img" aria-label={alt}><img src="/images/logo.png" alt="" /><span>Malaya Campsite</span></div>
    : <div className="safe-image"><img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" onError={() => setFailed(true)} /></div>
}
