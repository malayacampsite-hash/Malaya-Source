import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, X } from 'lucide-react'
import type { Accommodation, BookingDraft } from '../types'
import { createBooking } from '../services/supabase'

type Props = { open: boolean; onClose: () => void; stays: Accommodation[]; presetStay?: string }

const blankForm = (stayId = ''): BookingDraft => ({
  accommodationId: stayId,
  checkIn: '', checkOut: '', guests: 2, fullName: '', email: '', phone: '', preferredArrival: '', notes: '',
})

function makeReference() {
  const stamp = Date.now().toString(36).slice(-5).toUpperCase()
  const salt = crypto.randomUUID().slice(0, 4).toUpperCase()
  return `MAL-${stamp}-${salt}`
}

export function BookingModal({ open, onClose, stays, presetStay }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<BookingDraft>(() => blankForm(presetStay))
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setReference('')
    setError('')
    setForm(blankForm(presetStay || stays[0]?.id || ''))
  }, [open, presetStay, stays])

  const stay = useMemo(() => stays.find(item => item.id === form.accommodationId) ?? stays[0], [stays, form.accommodationId])
  if (!open) return null

  const update = <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => {
    setForm(current => ({ ...current, [key]: value }))
    setError('')
  }

  const continueFromStepOne = () => {
    if (!form.accommodationId || !form.checkIn || !form.checkOut || !form.guests) return setError('Please choose your stay, dates, and guest count.')
    if (form.checkOut <= form.checkIn) return setError('Check-out must be after check-in.')
    if (form.guests < 1 || form.guests > (stay?.capacity ?? 2)) return setError(`This stay accepts up to ${stay?.capacity ?? 2} guests.`)
    setStep(2)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) return setError('Please provide your name, email, and phone number.')
    setBusy(true)
    const bookingReference = makeReference()
    try {
      await createBooking({
        ...form,
        id: crypto.randomUUID(),
        bookingReference,
        status: 'pending',
      })
      setReference(bookingReference)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not submit the booking request.')
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    onClose()
    window.setTimeout(() => setForm(blankForm(presetStay)), 120)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Malaya Campsite booking request">
      <div className="booking-modal">
        <button className="modal-close" onClick={close} aria-label="Close booking"><X size={18} /></button>
        {step < 3 ? <>
          <div className="booking-modal-top">
            <div><span className="eyebrow">BOOKING REQUEST</span><h2>Reserve a little more time outdoors.</h2><p>Three quick steps. No payment is taken at this stage; the Malaya team confirms the request.</p></div>
            <div className="step-indicator"><span className={step >= 1 ? 'active' : ''}>01</span><i /><span className={step >= 2 ? 'active' : ''}>02</span></div>
          </div>
          <form onSubmit={step === 1 ? event => { event.preventDefault(); continueFromStepOne() } : submit}>
            {step === 1 ? <section className="booking-step">
              <div className="field-group"><label>Stay</label><select value={form.accommodationId} onChange={e => update('accommodationId', e.target.value)}>{stays.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="booking-grid two"><div className="field-group"><label>Check-in</label><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.checkIn} onChange={e => update('checkIn', e.target.value)} required /></div><div className="field-group"><label>Check-out</label><input type="date" min={form.checkIn || new Date().toISOString().slice(0, 10)} value={form.checkOut} onChange={e => update('checkOut', e.target.value)} required /></div></div>
              <div className="booking-grid two"><div className="field-group"><label>Guests</label><input type="number" min="1" max={stay?.capacity ?? 2} value={form.guests} onChange={e => update('guests', Number(e.target.value))} required /></div><div className="field-group"><label>Preferred arrival <span>optional</span></label><input type="time" value={form.preferredArrival} onChange={e => update('preferredArrival', e.target.value)} /></div></div>
              <div className="booking-summary"><div><CalendarDays size={16} /><span>{stay?.name}</span></div><strong>{form.guests} guest{form.guests === 1 ? '' : 's'}</strong></div>
            </section> : <section className="booking-step">
              <div className="booking-grid two"><div className="field-group"><label>Full name</label><input value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Your full name" autoComplete="name" required /></div><div className="field-group"><label>Phone number</label><input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="09xx xxx xxxx" autoComplete="tel" required /></div></div>
              <div className="field-group"><label>Email address</label><input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
              <div className="field-group"><label>Notes <span>optional</span></label><textarea rows={5} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Special requests, group notes, or anything the team should know…" /></div>
              <div className="booking-summary"><div><span>Requested stay</span><strong>{stay?.name}</strong></div><div><span>Dates</span><strong>{form.checkIn || '—'} → {form.checkOut || '—'}</strong></div></div>
            </section>}
            {error ? <p className="form-error">{error}</p> : null}
            <div className="booking-actions">{step === 2 ? <button type="button" className="button button-quiet" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</button> : <span />}{step === 1 ? <button className="button button-primary" type="submit">Continue <ArrowRight size={16} /></button> : <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Sending request…' : 'Send booking request'} <ArrowRight size={16} /></button>}</div>
          </form>
        </> : <div className="booking-success">
          <div className="success-mark"><Check size={22} /></div>
          <span className="eyebrow">REQUEST RECEIVED</span>
          <h2>We have your dates.</h2>
          <p>Your booking request is now in the Malaya Campsite system. Keep this reference for follow-up.</p>
          <div className="reference-box"><span>REFERENCE</span><strong>{reference}</strong></div>
          <button className="button button-primary" onClick={close}>Done</button>
        </div>}
      </div>
    </div>
  )
}
