import type { Accommodation, BookingDraft } from '../types'

const CAMPSITE_TIME_ZONE = 'Asia/Manila'

export function getCampsiteToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPSITE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(0)
  next.setUTCHours(0, 0, 0, 0)
  next.setUTCFullYear(year, month - 1, day + days)
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function cleanText(value: string, max: number) {
  return value.replace(/\u0000/g, '').replace(/[\u0001-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function validateBookingSelection(
  selection: Pick<BookingDraft, 'accommodationId' | 'checkIn' | 'checkOut' | 'guests'>,
  stays: Accommodation[],
  today = getCampsiteToday(),
) {
  const stay = stays.find(item => item.id === selection.accommodationId)
  if (!stay) throw new Error('Please choose an available stay.')
  if (!isCalendarDate(selection.checkIn) || !isCalendarDate(selection.checkOut)) {
    throw new Error('Please choose valid check-in and check-out dates.')
  }
  if (selection.checkIn < today) throw new Error('Check-in cannot be before today in Nasugbu.')
  if (selection.checkOut <= selection.checkIn) throw new Error('Check-out must be after check-in.')
  if (!Number.isInteger(selection.guests) || selection.guests < 1 || selection.guests > stay.capacity) {
    throw new Error(`This stay accepts 1 to ${stay.capacity} guests.`)
  }
  return stay
}

export function validateBookingDraft(draft: BookingDraft, stays: Accommodation[], today = getCampsiteToday()): BookingDraft {
  validateBookingSelection(draft, stays, today)

  const fullName = cleanText(draft.fullName, 120)
  const email = cleanText(draft.email, 254).toLowerCase()
  const phone = cleanText(draft.phone, 40)
  const notes = cleanText(draft.notes, 2000)
  const preferredArrival = draft.preferredArrival.trim()

  if (!fullName) throw new Error('Please provide your full name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.')
  const phoneDigits = phone.replace(/\D/g, '')
  if (!/^\+?[\d\s().-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    throw new Error('Please enter a valid phone number.')
  }
  if (preferredArrival && !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredArrival)) {
    throw new Error('Please enter a valid preferred arrival time.')
  }

  return { ...draft, fullName, email, phone, notes, preferredArrival }
}
