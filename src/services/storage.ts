import type { BookingRecord } from '../types'
import { isSupabaseConfigured, supabaseRest } from './supabase'

export async function createBooking(record: BookingRecord) {
  if (!isSupabaseConfigured()) throw new Error('Booking is temporarily unavailable. Please add the Supabase environment variables.')

  await supabaseRest('bookings', {
    method: 'POST',
    body: {
      id: record.id,
      booking_reference: record.bookingReference,
      accommodation_id: record.accommodationId,
      check_in: record.checkIn,
      check_out: record.checkOut,
      guests: record.guests,
      full_name: record.fullName,
      email: record.email,
      phone: record.phone,
      notes: record.notes || null,
      status: record.status,
    },
    prefer: 'return=minimal',
  })
  return record
}
