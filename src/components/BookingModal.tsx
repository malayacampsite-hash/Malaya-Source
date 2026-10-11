import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, X } from 'lucide-react'
import type { Accommodation, BookingDraft } from '../types'
import { createBooking } from '../services/supabase'
import { addCalendarDays, getCampsiteToday, validateBookingSelection } from '../services/bookingValidation'

type Props = { open: boolean; onClose: () => void; stays: Accommodation[]; presetStay?: string }

const blankForm = (stayId = ''): BookingDraft => ({
  accommodationId: stayId,
  checkIn: '', checkOut: '', guests: 2, fullName: '', email: '', phone: '', preferredArrival: '', notes: '',
})

function makeReference() {
  const stamp = Date.now().toString(36).slice(-5).toUpperCase()
  const salt = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  return `MAL-${stamp}-${salt}`
}

function initialStayId(stays: Accommodation[], presetStay?: string) {
  return stays.find(item => item.id === presetStay)?.id ?? stays[0]?.id ?? ''
}

export function BookingModal({ open, onClose, stays, presetStay }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<BookingDraft>(() => blankForm(presetStay))
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setReference('')
    setError('')
    setForm(blankForm(initialStayId(stays, presetStay)))
  }, [open, presetStay])

  useEffect(() => {
    if (!open || stays.some(item => item.id === form.accommodationId)) return
    const nextStayId = initialStayId(stays, presetStay)
    if (nextStayId !== form.accommodationId) {
      setForm(current => ({ ...current, accommodationId: nextStayId }))
    }
  }, [open, presetStay, stays, form.accommodationId])

  const stay = useMemo(() => stays.find(item => item.id === form.accommodationId), [stays, form.accommodationId])
  const campsiteToday = getCampsiteToday()
  if (!open) return null

  const update = <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => {
    setForm(current => ({ ...current, [key]: value }))
    setError('')
  }

  const continueFromStepOne = () => {
    try {
      validateBookingSelection(form, stays)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please review your stay, dates, and guest count.')
    }
  }

  const changeCheckIn = (checkIn: string) => {
    setForm(current => ({
      ...current,
      checkIn,
      checkOut: current.checkOut > checkIn ? current.checkOut : '',
    }))
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (submittingRef.current) return
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) return setError('Please provide your name, email, and phone number.')
    submittingRef.current = true
    setBusy(true)
    try {
      const bookingReference = makeReference()
      await createBooking({
        ...form,
        id: crypto.randomUUID(),
        bookingReference,
        status: 'pending',
      }, stays)
      setReference(bookingReference)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not submit the booking request.')
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  const close = () => {
    if (submittingRef.current) return
    onClose()
    window.setTimeout(() => setForm(blankForm(presetStay)), 120)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Malaya Campsite booking request">
      <div className="booking-modal">
        <button className="modal-close" onClick={close} aria-label="Close booking" disabled={busy}><X size={18} /></button>
        {step < 3 ? <>
          <div className="booking-modal-top">
            <div><span className="eyebrow">BOOKING REQUEST</span><h2>Reserve a little more time outdoors.</h2><p>Three quick steps. No payment is taken at this stage; the Malaya team confirms the request.</p></div>
            <div className="step-indicator"><span className={step >= 1 ? 'active' : ''}>01</span><i /><span className={step >= 2 ? 'active' : ''}>02</span></div>
          </div>
          <form onSubmit={step === 1 ? event => { event.preventDefault(); continueFromStepOne() } : submit}>
            {step === 1 ? <section className="booking-step">
              <div className="field-group"><label>Stay</label><select value={form.accommodationId} onChange={e => update('accommodationId', e.target.value)} required disabled={!stays.length || busy}>{stays.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!stays.length ? <small>No stays are available right now. Please contact Malaya directly.</small> : null}</div>
              <div className="booking-grid two"><div className="field-group"><label>Check-in</label><input type="date" min={campsiteToday} value={form.checkIn} onChange={e => changeCheckIn(e.target.value)} required disabled={busy} /></div><div className="field-group"><label>Check-out</label><input type="date" min={form.checkIn ? addCalendarDays(form.checkIn, 1) : campsiteToday} value={form.checkOut} onChange={e => update('checkOut', e.target.value)} required disabled={busy} /></div></div>
              <div className="booking-grid two"><div className="field-group"><label>Guests</label><input type="number" min="1" max={stay?.capacity ?? 2} value={form.guests} onChange={e => update('guests', Number(e.target.value))} required disabled={busy} /></div><div className="field-group"><label>Preferred arrival <span>optional</span></label><input type="time" value={form.preferredArrival} onChange={e => update('preferredArrival', e.target.value)} disabled={busy} /></div></div>
              <div className="booking-summary"><div><CalendarDays size={16} /><span>{stay?.name}</span></div><strong>{form.guests} guest{form.guests === 1 ? '' : 's'}</strong></div>
            </section> : <section className="booking-step">
              <div className="booking-grid two"><div className="field-group"><label>Full name</label><input value={form.fullName} onChange={e => update('fullName', e.target.value)} maxLength={120} placeholder="Your full name" autoComplete="name" required disabled={busy} /></div><div className="field-group"><label>Phone number</label><input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} maxLength={40} placeholder="09xx xxx xxxx" autoComplete="tel" required disabled={busy} /></div></div>
              <div className="field-group"><label>Email address</label><input type="email" value={form.email} onChange={e => update('email', e.target.value)} maxLength={254} placeholder="you@example.com" autoComplete="email" required disabled={busy} /></div>
              <div className="field-group"><label>Notes <span>optional</span></label><textarea rows={5} value={form.notes} onChange={e => update('notes', e.target.value)} maxLength={2000} placeholder="Special requests, group notes, or anything the team should know…" disabled={busy} /></div>
              <div className="booking-summary"><div><span>Requested stay</span><strong>{stay?.name}</strong></div><div><span>Dates</span><strong>{form.checkIn || '—'} → {form.checkOut || '—'}</strong></div></div>
            </section>}
            {error ? <p className="form-error">{error}</p> : null}
            <div className="booking-actions">{step === 2 ? <button type="button" className="button button-quiet" onClick={() => setStep(1)} disabled={busy}><ArrowLeft size={15} /> Back</button> : <span />}{step === 1 ? <button className="button button-primary" type="submit" disabled={!stays.length}>Continue <ArrowRight size={16} /></button> : <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Sending request…' : 'Send booking request'} <ArrowRight size={16} /></button>}</div>
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
