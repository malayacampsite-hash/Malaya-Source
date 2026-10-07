import type { BookingDraft, BookingStatus } from '../types'
import { createBooking as createSupabaseBooking } from './supabase'

export type BookingRecord = BookingDraft & {
  id: string
  bookingReference: string
  status: BookingStatus
}

/**
 * Backwards-compatible booking service wrapper.
 * The active data layer is Supabase; this file simply delegates to it.
 */
export async function createBooking(record: BookingRecord) {
  await createSupabaseBooking(record)
  return record
}
