import { createClient, type Session } from '@supabase/supabase-js'
import type { BookingDraft, BookingStatus } from '../types'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export function isSupabaseConfigured() { return Boolean(supabase) }

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return supabase
}

export async function getSiteSetting(key: string): Promise<string | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('site_settings').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  if (typeof data?.value === 'string') return data.value
  return data?.value ? String(data.value).replace(/^"|"$/g, '') : null
}

export async function createBooking(data: BookingDraft & { id: string; bookingReference: string; status: BookingStatus }) {
  const client = requireSupabase()
  const { error } = await client.from('bookings').insert({
    id: data.id,
    booking_reference: data.bookingReference,
    accommodation_id: data.accommodationId,
    check_in: data.checkIn,
    check_out: data.checkOut,
    guests: data.guests,
    full_name: data.fullName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    preferred_arrival: data.preferredArrival || null,
    notes: data.notes.trim() || null,
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
}

export async function listBookings(session?: Session) {
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

export async function sendStaffMessage(conversationId: string, text: string, adminName?: string | null) {
  const client = requireSupabase()
  const { error } = await client.from('support_messages').insert({ conversation_id: conversationId, sender: 'staff', text: text.trim(), admin_name: adminName || null })
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
  const { error } = await client.rpc('update_support_visitor', { p_conversation_id: conversationId, p_visitor_token: visitorToken, p_visitor_name: contact.name || null, p_visitor_email: contact.email || null, p_visitor_phone: contact.phone || null })
  if (error) throw error
}

export async function addVisitorMessage(conversationId: string, visitorToken: string, text: string, sender: 'visitor' | 'bot') {
  const client = requireSupabase()
  const { error } = await client.rpc('add_support_message', { p_conversation_id: conversationId, p_visitor_token: visitorToken, p_sender: sender, p_text: text })
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
