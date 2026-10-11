import { createClient } from '@supabase/supabase-js'
import { accommodation } from '../data/siteContent'
import type { Accommodation, BookingDraft, BookingStatus, SiteReview } from '../types'
import { validateBookingDraft } from './bookingValidation'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
// Current Supabase API key model: use a publishable key in browser code.
// The anon-key fallback keeps existing local deployments working during migration.
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ''

export const supabase = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export function isSupabaseConfigured() { return Boolean(supabase) }

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  return supabase
}

function normalizeSupportText(value: string, max: number) {
  return value.replace(/\u0000/g, '').replace(/[\u0001-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export async function getSiteSetting(key: string): Promise<string | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('site_settings').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  if (typeof data?.value === 'string') return data.value
  return data?.value ? String(data.value).replace(/^"|"$/g, '') : null
}

export async function listActiveAccommodations(): Promise<Accommodation[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('accommodation_inventory')
    .select('id, name, short_description, capacity, price_label, features, image')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(item => ({
    id: item.id,
    name: item.name,
    shortDescription: item.short_description,
    capacity: item.capacity,
    priceLabel: item.price_label,
    features: item.features,
    image: item.image,
  })) as Accommodation[]
}

export async function createBooking(
  data: BookingDraft & { id: string; bookingReference: string; status: BookingStatus },
  stays: Accommodation[] = accommodation,
) {
  const client = requireSupabase()
  const booking = validateBookingDraft(data, stays)
  if (data.status !== 'pending') throw new Error('A new booking request must start as pending.')
  const { error } = await client.from('bookings').insert({
    id: data.id,
    booking_reference: data.bookingReference,
    accommodation_id: booking.accommodationId,
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    guests: booking.guests,
    full_name: booking.fullName,
    email: booking.email,
    phone: booking.phone,
    preferred_arrival: booking.preferredArrival || null,
    notes: booking.notes || null,
    status: data.status,
  })
  if (error) throw error
}

export type SupabaseAdminBooking = {
  id: string
  booking_reference: string
  accommodation_id: string
  check_in: string
  check_out: string
  guests: number
  full_name: string
  email: string
  phone: string
  preferred_arrival: string | null
  notes: string | null
  status: BookingStatus
  created_at: string
  sheet_row_number: number | null
  sheet_synced_at: string | null
  sheet_sync_error: string | null
  receipt_sent_at: string | null
  receipt_processing_at: string | null
  receipt_last_error: string | null
  receipt_retry_requested_at: string | null
}

export async function listBookings() {
  const client = requireSupabase()
  const { data, error } = await client.from('bookings').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as SupabaseAdminBooking[]
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const client = requireSupabase()
  const { error } = await client.from('bookings').update({ status }).eq('id', id)
  if (error) throw error
}

export async function requestBookingReceiptRetry(id: string) {
  const client = requireSupabase()
  const requestedAt = new Date().toISOString()
  const { data, error } = await client.from('bookings')
    .update({ receipt_retry_requested_at: requestedAt })
    .eq('id', id)
    .eq('status', 'confirmed')
    .is('receipt_sent_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error('This booking is no longer confirmed or its receipt was already sent.')
  return requestedAt
}

export type AdminConversation = {
  id: string
  visitor_name: string | null
  visitor_email: string | null
  visitor_phone: string | null
  mode: 'bot' | 'staff'
  status: 'open' | 'closed'
  created_at: string
  updated_at: string
}

export type AdminMessage = { id: string; conversation_id: string; sender: 'visitor' | 'bot' | 'staff'; text: string; created_at: string; admin_name: string | null }

export async function listConversations() {
  const client = requireSupabase()
  const { data, error } = await client.from('support_conversations').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  return data as AdminConversation[]
}

export async function listConversationMessages(conversationId: string) {
  const client = requireSupabase()
  const { data, error } = await client.from('support_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
  if (error) throw error
  return data as AdminMessage[]
}

export function subscribeToAdminMessages(
  conversationId: string,
  onInsert: (message: AdminMessage) => void,
  onStatus?: (status: string) => void,
) {
  const client = requireSupabase()
  return client.channel(`admin-support-messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'support_messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, payload => onInsert(payload.new as AdminMessage))
    .subscribe(status => onStatus?.(status))
}

export function subscribeToAdminConversations(
  onChange: () => void,
  onStatus?: (status: string) => void,
) {
  const client = requireSupabase()
  return client.channel('admin-support-conversations')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'support_conversations',
    }, onChange)
    .subscribe(status => onStatus?.(status))
}

export async function sendStaffMessage(conversationId: string, text: string, adminName?: string | null) {
  const client = requireSupabase()
  const message = normalizeSupportText(text, 2000)
  if (!message) throw new Error('Please write a message before sending.')
  const { error } = await client.rpc('send_support_staff_message', {
    p_conversation_id: conversationId,
    p_text: message,
    p_admin_name: adminName ? normalizeSupportText(adminName, 120) : null,
  })
  if (error) throw error
}

export async function closeConversation(conversationId: string) {
  const client = requireSupabase()
  const { error } = await client.from('support_conversations').update({ status: 'closed' }).eq('id', conversationId)
  if (error) throw error
}

export async function saveDailyMessage(message: string) {
  const client = requireSupabase()
  const { error } = await client.from('site_settings').upsert({ key: 'daily_message', value: message.trim() || 'A slower stay, a bamboo cabin, and more time outdoors.', updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function getSupportState(conversationId: string, visitorToken: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_support_state', { p_conversation_id: conversationId, p_visitor_token: visitorToken })
  if (error) throw error
  return data as Array<{ mode: 'bot' | 'staff'; status: 'open' | 'closed'; visitor_name: string | null; visitor_email: string | null; visitor_phone: string | null }>
}

export async function getVisitorMessages(conversationId: string, visitorToken: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_support_messages', { p_conversation_id: conversationId, p_visitor_token: visitorToken })
  if (error) throw error
  return data as Array<{ id: string; sender: 'visitor' | 'bot' | 'staff'; text: string; created_at: string }>
}

export async function createSupportConversation(visitorToken: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_support_conversation', { p_visitor_token: visitorToken })
  if (error) throw error
  return data as Array<{ id: string; visitor_token: string }>
}

export async function updateSupportVisitor(conversationId: string, visitorToken: string, contact: { name: string; email: string; phone: string }) {
  const client = requireSupabase()
  const name = normalizeSupportText(contact.name, 120)
  const email = normalizeSupportText(contact.email, 254).toLowerCase()
  const phone = normalizeSupportText(contact.phone, 40)
  if (!name) throw new Error('Please enter your name.')
  if (!email) throw new Error('Please enter your email address.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.')
  if (!phone) throw new Error('Please enter your phone number.')
  const phoneDigits = phone.replace(/\D/g, '')
  if (!/^\+?[\d\s().-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    throw new Error('Please enter a valid phone number.')
  }
  const { error } = await client.rpc('update_support_visitor', { p_conversation_id: conversationId, p_visitor_token: visitorToken, p_visitor_name: name || null, p_visitor_email: email || null, p_visitor_phone: phone || null })
  if (error) throw error
}

export async function addVisitorMessage(conversationId: string, visitorToken: string, text: string, sender: 'visitor' | 'bot') {
  const client = requireSupabase()
  const message = normalizeSupportText(text, 2000)
  if (!message) throw new Error('Please write a message before sending.')
  const { error } = await client.rpc('add_support_message', { p_conversation_id: conversationId, p_visitor_token: visitorToken, p_sender: sender, p_text: message })
  if (error) throw error
}

export async function setSupportMode(conversationId: string, visitorToken: string, mode: 'bot' | 'staff') {
  const client = requireSupabase()
  const { error } = await client.rpc('set_support_mode', { p_conversation_id: conversationId, p_visitor_token: visitorToken, p_mode: mode })
  if (error) throw error
}

export async function signInAdmin(email: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOutAdmin() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function verifyAdmin() {
  const client = requireSupabase()
  const { data, error } = await client.rpc('is_malaya_admin')
  if (error) throw error
  return data === true
}

export async function listPublishedReviews(limit = 12): Promise<SiteReview[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('site_reviews')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as SiteReview[]
}

export async function createReview(input: { fullName: string; rating: number; reviewText: string; photoData?: string | null }) {
  const client = requireSupabase()
  const fullName = input.fullName.replace(/\u0000/g, '').replace(/[\u0001-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  const reviewText = input.reviewText.replace(/\u0000/g, '').replace(/[\u0001-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
  const photoData = (input.photoData ?? '').replace(/\s/g, '')
  if (!fullName) throw new Error('Please provide your full name.')
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error('Please choose a star rating from 1 to 5.')
  if (!reviewText) throw new Error('Please write a review before submitting.')
  if (photoData && (!/^[A-Za-z0-9+/]+={0,2}$/.test(photoData) || photoData.length > 1800000)) {
    throw new Error('The review photo could not be validated.')
  }
  const { error } = await client.from('site_reviews').insert({
    full_name: fullName,
    rating: input.rating,
    review_text: reviewText,
    photo_data: photoData || null,
    published: false,
  })
  if (error) throw error
}

export async function listReviewsAdmin(): Promise<SiteReview[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('site_reviews')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SiteReview[]
}

export async function setReviewPublished(id: string, published: boolean) {
  const client = requireSupabase()
  const { error } = await client.from('site_reviews').update({ published }).eq('id', id)
  if (error) throw error
}

export async function deleteReview(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('site_reviews').delete().eq('id', id)
  if (error) throw error
}
