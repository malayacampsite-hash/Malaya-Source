import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, Check, ChevronLeft, ImagePlus, Star, X } from 'lucide-react'
import { createReview } from '../services/supabase'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const MAX_PHOTO_DATA_CHARS = 1_800_000
const MAX_WIDTH = 1400
const MAX_HEIGHT = 1050

function cleanText(value: string, max: number) {
  return value
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('We could not read that image. Please try another photo.'))
    }
    image.src = url
  })
}

async function convertToWebpBase64(file: File): Promise<{ base64: string; previewUrl: string }> {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowed.has(file.type)) {
    throw new Error('Please upload a JPG, PNG, or WebP image.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Please choose an image smaller than 8 MB.')
  }

  const image = await loadImage(file)
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('The selected image has no usable dimensions.')
  }

  const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the image.')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)

  let blob: Blob | null = null
  for (const quality of [0.78, 0.70, 0.62, 0.55]) {
    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (blob && blob.size <= 1_250_000) break
  }

  if (!blob || blob.type !== 'image/webp') {
    throw new Error('WebP conversion is not available in this browser.')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The image could not be prepared.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })

  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : ''
  if (!base64 || base64.length > MAX_PHOTO_DATA_CHARS) {
    throw new Error('That image is still too large after compression. Please choose a smaller photo.')
  }

  return {
    base64,
    previewUrl: URL.createObjectURL(blob),
  }
}

export function ReviewPage() {
  const [fullName, setFullName] = useState('')
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [photoData, setPhotoData] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    document.title = 'Leave a Review | Malaya Campsite'
    const meta = document.querySelector('meta[name="robots"]') ?? document.createElement('meta')
    meta.setAttribute('name', 'robots')
    meta.setAttribute('content', 'noindex, nofollow')
    document.head.appendChild(meta)

    return () => {
      meta.remove()
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setPhotoBusy(true)
    try {
      const result = await convertToWebpBase64(file)
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoData(result.base64)
      setPhotoPreview(result.previewUrl)
      setPhotoName(file.name.replace(/[^\w.\- ]/g, '').slice(0, 70))
    } catch (err) {
      setPhotoData('')
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoPreview('')
      setPhotoName('')
      setError(err instanceof Error ? err.message : 'We could not prepare that photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoData('')
    setPhotoPreview('')
    setPhotoName('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (honeypot.trim()) return

    const name = cleanText(fullName, 120)
    const text = cleanText(reviewText, 2000)

    if (!name) return setError('Please enter your full name.')
    if (!rating) return setError('Please choose a star rating.')
    if (!text) return setError('Please write your review.')

    setBusy(true)
    try {
      await createReview({
        fullName: name,
        rating,
        reviewText: text,
        photoData: photoData || null,
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not submit your review.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <main className="review-page">
        <div className="review-shell">
          <a href="/" className="review-back"><ChevronLeft size={16} /> Back to Malaya</a>
          <div className="review-success">
            <div className="success-mark"><Check size={22} /></div>
            <p className="eyebrow">THANK YOU</p>
            <h1>Your story is now part of Malaya.</h1>
            <p>Your review has been added to the guest stories on the website.</p>
            <a className="button button-primary" href="/#reviews">See the reviews</a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="review-page">
      <div className="review-shell">
        <a href="/" className="review-back"><ChevronLeft size={16} /> Back to Malaya</a>
        <div className="review-brand"><img src="/images/logo.png" alt="Malaya Campsite" /></div>

        <div className="review-intro">
          <p className="eyebrow">A NOTE AFTER YOUR STAY</p>
          <h1>How was your time at Malaya?</h1>
          <p>Share a few words about your stay. No account is needed.</p>
        </div>

        <form className="review-form" onSubmit={submit} noValidate>
          <div className="field-group">
            <label htmlFor="review-name">Full name</label>
            <input id="review-name" value={fullName} onChange={e => setFullName(e.target.value)} maxLength={120} autoComplete="name" placeholder="Your full name" required />
          </div>

          <div className="field-group">
            <label>Rating</label>
            <div className="review-stars" role="radiogroup" aria-label="Rating from 1 to 5 stars">
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  type="button"
                  className={value <= rating ? 'selected' : ''}
                  onClick={() => setRating(value)}
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                  aria-checked={rating === value}
                  role="radio"
                >
                  <Star size={29} fill={value <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="review-text">Your review</label>
            <textarea id="review-text" value={reviewText} onChange={e => setReviewText(e.target.value)} maxLength={2000} rows={8} placeholder="Tell us about your stay." required />
          </div>

          <div className="field-group">
            <div className="photo-upload-head">
              <label htmlFor="review-photo">Guest photo <span>optional</span></label>
              <small>JPG, PNG or WebP · up to 8 MB</small>
            </div>
            <label className={`photo-dropzone ${photoPreview ? 'has-photo' : ''}`} htmlFor="review-photo">
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Selected guest photo preview" className="photo-preview" />
                  <span className="photo-overlay"><Camera size={16} /> Change photo</span>
                </>
              ) : (
                <span className="photo-empty">
                  <ImagePlus size={22} />
                  <strong>Add a photo from your stay</strong>
                  <small>Your photo is compressed to WebP before it is saved.</small>
                </span>
              )}
              <input id="review-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} disabled={photoBusy || busy} />
            </label>

            {photoName ? (
              <div className="photo-meta">
                <span>{photoName}</span>
                <button type="button" onClick={removePhoto} aria-label="Remove photo"><X size={14} /></button>
              </div>
            ) : null}
            {photoBusy ? <p className="photo-processing">Preparing your photo…</p> : null}
          </div>

          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} className="review-honeypot" aria-hidden="true" />
          {error ? <p className="form-error">{error}</p> : null}

          <button className="button button-primary review-submit" type="submit" disabled={busy || photoBusy}>
            {busy ? 'Sending…' : 'Submit review'}
          </button>
          <p className="review-privacy">Reviews are displayed as plain text. Uploaded photos are converted to WebP and stored as image data; no account is required.</p>
        </form>
      </div>
    </main>
  )
}
