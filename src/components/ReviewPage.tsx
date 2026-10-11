import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, Check, ChevronLeft, ImagePlus, Star, X } from 'lucide-react'
import { createReview } from '../services/supabase'
import { setNoIndexPageMetadata } from '../services/pageMeta'

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
      reject(new Error('Safari could not read this photo format. Try sharing it as a JPEG, then choose it again.'))
    }
    image.src = url
  })
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  if (typeof canvas.toBlob === 'function') {
    return new Promise(resolve => {
      try {
        canvas.toBlob(blob => resolve(blob), mimeType, quality)
      } catch {
        resolve(null)
      }
    })
  }

  // Older Safari fallback for browsers that expose toDataURL but not toBlob.
  try {
    const dataUrl = canvas.toDataURL(mimeType, quality)
    const [header, payload] = dataUrl.split(',')
    if (!header || !payload) return null
    const actualType = header.match(/^data:([^;]+)/i)?.[1] ?? mimeType
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: actualType })
  } catch {
    return null
  }
}

async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const formats = [
    { type: 'image/webp', qualities: [0.82, 0.74, 0.66, 0.58, 0.50] },
    { type: 'image/jpeg', qualities: [0.84, 0.76, 0.68, 0.60, 0.52, 0.44] },
  ]
  let smallest: Blob | null = null

  for (const format of formats) {
    for (const quality of format.qualities) {
      const blob = await canvasToBlob(canvas, format.type, quality)
      // Some browsers silently ignore an unsupported requested format and
      // return PNG instead. Detect that and move on to the next format.
      if (!blob || blob.type.toLowerCase() !== format.type) break
      if (!smallest || blob.size < smallest.size) smallest = blob
      if (blob.size <= 1_250_000) return blob
    }
  }
  return smallest
}

async function convertReviewPhoto(file: File): Promise<{ base64: string; previewUrl: string }> {
  const allowed = new Set([
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/heic', 'image/heif', 'image/avif',
  ])
  const fileType = file.type.toLowerCase()
  const extensionLooksSupported = /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name)
  if (!allowed.has(fileType) && !(fileType === '' && extensionLooksSupported)) {
    throw new Error('Please choose a JPG, PNG, WebP, or supported iPhone photo format.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Please choose an image smaller than 8 MB.')
  }

  const image = await loadImage(file)
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('This photo format could not be read by your browser. Try exporting it as JPG and selecting it again.')
  }

  const originalScale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight)
  let chosenBlob: Blob | null = null
  let smallestBlob: Blob | null = null

  // Re-encode at progressively smaller dimensions if a high-detail photo
  // remains too large, while always preferring WebP and falling back to JPEG.
  for (const dimensionScale of [1, 0.86, 0.73, 0.62]) {
    const width = Math.max(1, Math.round(image.naturalWidth * originalScale * dimensionScale))
    const height = Math.max(1, Math.round(image.naturalHeight * originalScale * dimensionScale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare the image.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)

    const candidate = await encodeCanvas(canvas)
    if (candidate && (!smallestBlob || candidate.size < smallestBlob.size)) smallestBlob = candidate
    if (candidate && candidate.size <= 1_250_000) {
      chosenBlob = candidate
      break
    }
  }

  chosenBlob ??= smallestBlob
  if (!chosenBlob || !['image/webp', 'image/jpeg'].includes(chosenBlob.type.toLowerCase())) {
    throw new Error('Your browser could not compress this photo. Please try a JPG or PNG image.')
  }
  if (chosenBlob.size > 1_250_000) {
    throw new Error('This photo is still too large after compression. Please choose a smaller photo.')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The image could not be prepared. Please try again.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(chosenBlob)
  })

  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : ''
  if (!base64 || base64.length > MAX_PHOTO_DATA_CHARS) {
    throw new Error('That image is still too large after compression. Please choose a smaller photo.')
  }

  return { base64, previewUrl: URL.createObjectURL(chosenBlob) }
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
  const submittingRef = useRef(false)

  useEffect(() => setNoIndexPageMetadata('Leave a Review | Malaya Campsite'), [])

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setPhotoBusy(true)
    try {
      const result = await convertReviewPhoto(file)
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
    if (submittingRef.current || busy || photoBusy) return
    if (honeypot.trim()) return

    const name = cleanText(fullName, 120)
    const text = cleanText(reviewText, 2000)

    if (!name) return setError('Please enter your full name.')
    if (!rating) return setError('Please choose a star rating.')
    if (!text) return setError('Please write your review.')

    submittingRef.current = true
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
      submittingRef.current = false
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
            <p>Your review has been sent to Malaya for approval. It will appear in the guest stories once published.</p>
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
              <small>JPG, PNG, WebP, or supported iPhone photo formats · up to 8 MB</small>
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
                  <small>Your photo is automatically resized and compressed before it is saved.</small>
                </span>
              )}
              <input id="review-photo" type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.avif,image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" onChange={handlePhoto} disabled={photoBusy || busy} />
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
          <p className="review-privacy">Reviews are checked by the Malaya team before display. Uploaded photos are resized and compressed before secure storage; no account is required.</p>
        </form>
      </div>
    </main>
  )
}
