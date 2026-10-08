import { withSupabase } from 'npm:@supabase/server@^1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SHEET_ID = Deno.env.get('GOOGLE_SHEET_ID') ?? ''
const SHEET_RANGE = Deno.env.get('GOOGLE_SHEET_RANGE') ?? 'Bookings!A:O'
const SHEET_NAME = (SHEET_RANGE.split('!')[0] || 'Bookings').replace(/^'+|'+$/g, '')
const GMAIL_SENDER = Deno.env.get('GMAIL_SENDER_EMAIL') ?? 'malayacampsite@gmail.com'
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? ''
const PUBLIC_SITE_URL = (Deno.env.get('MALAYA_PUBLIC_SITE_URL') ?? '').replace(/\/$/, '')
const LOGO_URL = Deno.env.get('MALAYA_LOGO_URL') || (PUBLIC_SITE_URL ? `${PUBLIC_SITE_URL}/images/logo.png` : '')
type BookingRecord = {
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
  status: 'pending' | 'confirmed' | 'declined' | 'completed'
  created_at: string
  updated_at?: string
  sheet_row_number?: number | null
  sheet_synced_at?: string | null
  sheet_sync_error?: string | null
  receipt_sent_at?: string | null
  receipt_processing_at?: string | null
  receipt_last_error?: string | null
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: BookingRecord | null
  old_record: BookingRecord | null
}
function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function normalizeText(value: string | null | undefined, max = 2000) {
  return (value ?? '').replace(/\u0000/g, '').replace(/[\u0001-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

function safeSheetCell(value: unknown) {
  const text = normalizeText(value == null ? '' : String(value), 2000)
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

function stayName(id: string) {
  const names: Record<string, string> = {
    'kanlungan-cabin': 'Kanlungan Cabin',
    tahanan: 'Tahanan',
    'family-hut': 'Family hut',
  }
  return names[id] ?? id
}

function bookingRow(booking: BookingRecord) {
  return [
    safeSheetCell(booking.id),
    safeSheetCell(booking.booking_reference),
    safeSheetCell(stayName(booking.accommodation_id)),
    safeSheetCell(booking.check_in),
    safeSheetCell(booking.check_out),
    safeSheetCell(booking.guests),
    safeSheetCell(booking.full_name),
    safeSheetCell(booking.email),
    safeSheetCell(booking.phone),
    safeSheetCell(booking.preferred_arrival ?? ''),
    safeSheetCell(booking.notes ?? ''),
    safeSheetCell(booking.status),
    safeSheetCell(booking.created_at),
    safeSheetCell(booking.updated_at ?? booking.created_at),
    safeSheetCell(booking.receipt_sent_at ?? ''),
  ]
}

function sheetHeaders() {
  return [
    'Booking ID', 'Booking Reference', 'Stay', 'Check-in', 'Check-out', 'Guests',
    'Full Name', 'Email', 'Phone', 'Preferred Arrival', 'Notes', 'Status',
    'Created At', 'Updated At', 'Receipt Sent At',
  ]
}

async function googleAccessToken() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) throw new Error('Google OAuth secrets are not configured.')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const payload = await response.json() as { access_token?: string; error?: string; error_description?: string }
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || 'Google OAuth token refresh failed.')
  return payload.access_token
}

async function ensureSheetHeader(token: string) {
  const headerRange = `${SHEET_NAME}!A1:O1`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}/values/${encodeURIComponent(headerRange)}`
  const read = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!read.ok) throw new Error(`Google Sheets read failed (${read.status}).`)
  const data = await read.json() as { values?: string[][] }
  if (data.values?.[0]?.length) return
  const update = await fetch(`${url}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: headerRange, majorDimension: 'ROWS', values: [sheetHeaders()] }),
  })
  if (!update.ok) throw new Error(`Google Sheets header write failed (${update.status}).`)
}

function extractRowNumber(updatedRange: string | undefined) {
  if (!updatedRange) return null
  const match = updatedRange.match(/!\$?A\$?(\d+):/)
  return match ? Number(match[1]) : null
}

async function appendBookingToSheet(token: string, booking: BookingRecord) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}/values/${encodeURIComponent(SHEET_RANGE)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=false`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ majorDimension: 'ROWS', values: [bookingRow(booking)] }),
  })
  const payload = await response.json() as { updates?: { updatedRange?: string }; error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Google Sheets append failed (${response.status}).`)
  return extractRowNumber(payload.updates?.updatedRange)
}

async function updateBookingSheetRow(token: string, booking: BookingRecord, rowNumber: number) {
  const range = `${SHEET_NAME}!A${rowNumber}:O${rowNumber}`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`
  const response = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values: [bookingRow(booking)] }),
  })
  const payload = await response.json() as { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Google Sheets update failed (${response.status}).`)
}

async function findBookingRowByReference(token: string, bookingReference: string) {
  const range = `${SHEET_NAME}!A:O`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const payload = await response.json() as { values?: string[][]; error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Google Sheets lookup failed (${response.status}).`)
  const index = (payload.values ?? []).findIndex((row, rowIndex) => rowIndex > 0 && row[1] === bookingReference)
  return index >= 0 ? index + 1 : null
}

async function syncBookingToSheet(booking: BookingRecord) {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID is not configured.')
  const token = await googleAccessToken()
  await ensureSheetHeader(token)
  let rowNumber = Number(booking.sheet_row_number ?? 0)
  if (rowNumber > 1) {
    await updateBookingSheetRow(token, booking, rowNumber)
  } else {
    const found = await findBookingRowByReference(token, booking.booking_reference)
    if (found) {
      rowNumber = found
      await updateBookingSheetRow(token, booking, rowNumber)
    } else {
      rowNumber = (await appendBookingToSheet(token, booking)) ?? 0
      if (!rowNumber) throw new Error('Google Sheets did not return the appended row number.')
    }
  }
  return rowNumber
}

function escapeHtml(value: unknown) {
  return normalizeText(value == null ? '' : String(value), 2000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(parsed)
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

function htmlReceipt(booking: BookingRecord) {
  const note = booking.notes ? `<div style="margin-top:22px;padding:16px 18px;background:#f3f5ef;border-left:3px solid #1f4c37"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#65756a;font-weight:700;margin-bottom:7px">Guest notes</div><div style="font-size:14px;line-height:1.7;color:#28352e">${escapeHtml(booking.notes)}</div></div>` : ''
  const logo = LOGO_URL ? `<img src="cid:malaya-logo" alt="Malaya Campsite" style="display:block;height:48px;width:auto;max-width:220px" />` : '<div style="font-size:24px;font-weight:800;letter-spacing:.08em;color:#1a6b2a">MALAYA</div><div style="font-size:8px;letter-spacing:.35em;color:#617064;margin-top:2px">CAMPSITE</div>'
  return `<!doctype html><html><body style="margin:0;background:#eef0e9;font-family:Arial,Helvetica,sans-serif;color:#203127"><div style="padding:30px 12px"><div style="max-width:620px;margin:0 auto;background:#fffef8;border:1px solid #d8ded5"><div style="padding:26px 28px;border-bottom:1px solid #d8ded5;background:#f7f8f2">${logo}<div style="margin-top:24px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6c766f;font-weight:700">Booking confirmation</div><div style="margin-top:7px;font-size:30px;line-height:1.08;font-family:Georgia,serif;color:#173b2b">Your stay is confirmed.</div><div style="margin-top:10px;font-size:14px;line-height:1.7;color:#65736a">Thank you for choosing Malaya Campsite. We look forward to welcoming you to Nasugbu, Batangas.</div></div><div style="padding:28px"><div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start"><div><div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#708078;font-weight:700">Reference</div><div style="font-size:18px;font-weight:700;color:#183b2b;margin-top:5px">${escapeHtml(booking.booking_reference)}</div></div><div style="text-align:right"><div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#708078;font-weight:700">Status</div><div style="font-size:18px;font-weight:700;color:#2e6a48;margin-top:5px">Confirmed</div></div></div><div style="margin-top:26px;border-top:1px solid #d8ded5;border-bottom:1px solid #d8ded5"><div style="padding:15px 0;display:flex;justify-content:space-between;gap:20px"><span style="color:#758079;font-size:13px">Accommodation</span><strong style="font-size:14px">${escapeHtml(stayName(booking.accommodation_id))}</strong></div><div style="padding:15px 0;display:flex;justify-content:space-between;gap:20px;border-top:1px solid #e5e9e1"><span style="color:#758079;font-size:13px">Check-in</span><strong style="font-size:14px">${escapeHtml(formatDate(booking.check_in))}</strong></div><div style="padding:15px 0;display:flex;justify-content:space-between;gap:20px;border-top:1px solid #e5e9e1"><span style="color:#758079;font-size:13px">Check-out</span><strong style="font-size:14px">${escapeHtml(formatDate(booking.check_out))}</strong></div><div style="padding:15px 0;display:flex;justify-content:space-between;gap:20px;border-top:1px solid #e5e9e1"><span style="color:#758079;font-size:13px">Guests</span><strong style="font-size:14px">${escapeHtml(booking.guests)} guest${booking.guests === 1 ? '' : 's'}</strong></div>${booking.preferred_arrival ? `<div style="padding:15px 0;display:flex;justify-content:space-between;gap:20px;border-top:1px solid #e5e9e1"><span style="color:#758079;font-size:13px">Preferred arrival</span><strong style="font-size:14px">${escapeHtml(booking.preferred_arrival)}</strong></div>` : ''}</div>${note}<div style="margin-top:24px;padding:17px 18px;background:#173d2c;color:#fff"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#cfe0d3;font-weight:700">At a glance</div><div style="margin-top:7px;font-size:14px;line-height:1.7">22-hour stay · Nasugbu, Batangas</div></div></div><div style="padding:20px 28px;border-top:1px solid #d8ded5;background:#f7f8f2;color:#6b776f;font-size:12px;line-height:1.7"><strong style="color:#1f392b">Malaya Campsite</strong><br/>Pulo, Brgy. Kaylaway, Nasugbu, Batangas<br/><a href="mailto:${GMAIL_SENDER}" style="color:#1f5b40;text-decoration:none">${GMAIL_SENDER}</a><br/><span>Keep this email for your booking details.</span><div style="margin-top:12px;font-size:10px;color:#87928a">${escapeHtml(formatDateTime(booking.created_at))}</div></div></div></div></body></html>`
}

function randomBoundary() {
  return `----malaya-${crypto.randomUUID()}`
}

function binaryBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

function base64Url(bytes: Uint8Array) {
  return binaryBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function utf8Base64Url(value: string) {
  return base64Url(new TextEncoder().encode(value))
}

async function sendBookingReceipt(booking: BookingRecord) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) throw new Error('Gmail OAuth secrets are not configured.')
  const token = await googleAccessToken()
  const boundary = randomBoundary()
  let imagePart = ''
  if (LOGO_URL) {
    try {
      const logoResponse = await fetch(LOGO_URL)
      if (logoResponse.ok) {
        const bytes = new Uint8Array(await logoResponse.arrayBuffer())
        imagePart = `--${boundary}\r\nContent-Type: ${logoResponse.headers.get('content-type') || 'image/png'}\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <malaya-logo>\r\nContent-Disposition: inline; filename="malaya-logo.png"\r\n\r\n${binaryBase64(bytes)}\r\n`
      }
    } catch {
      // Email is still sent without the inline image fallback.
    }
  }

  const html = imagePart ? htmlReceipt(booking) : htmlReceipt(booking).replace(/<img src="cid:malaya-logo"[^>]*\/>/, '<div style="font-size:24px;font-weight:800;letter-spacing:.08em;color:#1a6b2a">MALAYA</div><div style="font-size:8px;letter-spacing:.35em;color:#617064;margin-top:2px">CAMPSITE</div>')
  const message = [
    `From: Malaya Campsite <${GMAIL_SENDER}>`,
    `To: ${escapeHeader(booking.email)}`,
    `Reply-To: ${GMAIL_SENDER}`,
    `Subject: Malaya Campsite Booking Confirmation - ${booking.booking_reference}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    imagePart,
    `--${boundary}--`,
  ].join('\r\n')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: utf8Base64Url(message) }),
  })
  const payload = await response.json() as { id?: string; error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Gmail send failed (${response.status}).`)
  return payload.id ?? null
}

function escapeHeader(value: string) {
  return normalizeText(value, 200).replace(/[\r\n<>]/g, '')
}

function bookingMeaningfullyChanged(oldRecord: BookingRecord | null, record: BookingRecord) {
  if (!oldRecord) return true
  const fields: (keyof BookingRecord)[] = [
    'booking_reference', 'accommodation_id', 'check_in', 'check_out', 'guests', 'full_name',
    'email', 'phone', 'preferred_arrival', 'notes', 'status', 'created_at',
  ]
  return fields.some(field => oldRecord[field] !== record[field])
}

async function writeAutomationMetadata(
  supabaseAdmin: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  await supabaseAdmin.from('bookings').update(patch).eq('id', id)
}

async function claimReceipt(
  supabaseAdmin: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update({ receipt_processing_at: new Date().toISOString() })
    .eq('id', id)
    .is('receipt_sent_at', null)
    .is('receipt_processing_at', null)
    .select('id')
    .maybeSingle()
  return !error && Boolean(data?.id)
}

async function processBooking(
  payload: WebhookPayload,
  supabaseAdmin: SupabaseClient,
) {
  const booking = payload.record
  if (!booking || payload.table !== 'bookings' || payload.schema !== 'public') return { ignored: true }
  if (payload.type === 'DELETE') return { ignored: true }
  if (payload.type === 'UPDATE' && !bookingMeaningfullyChanged(payload.old_record, booking)) return { ignored: true }

  const result: Record<string, unknown> = { booking_id: booking.id, spreadsheet: 'skipped', receipt: 'skipped' }

  if (SHEET_ID) {
    try {
      const rowNumber = await syncBookingToSheet(booking)
      result.spreadsheet = 'synced'
      result.sheet_row_number = rowNumber
      await writeAutomationMetadata(supabaseAdmin, booking.id, { sheet_row_number: rowNumber, sheet_synced_at: new Date().toISOString(), sheet_sync_error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown spreadsheet error.'
      result.spreadsheet = 'failed'
      result.spreadsheet_error = message
      await writeAutomationMetadata(supabaseAdmin, booking.id, { sheet_sync_error: message })
    }
  }

  const becameConfirmed = booking.status === 'confirmed' && payload.old_record?.status !== 'confirmed'
  if (becameConfirmed && !booking.receipt_sent_at) {
    const claimed = await claimReceipt(supabaseAdmin, booking.id)
    if (claimed) {
      try {
        const messageId = await sendBookingReceipt(booking)
        result.receipt = 'sent'
        result.gmail_message_id = messageId
        await writeAutomationMetadata(supabaseAdmin, booking.id, { receipt_sent_at: new Date().toISOString(), receipt_processing_at: null, receipt_last_error: null })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Gmail error.'
        result.receipt = 'failed'
        result.receipt_error = message
        await writeAutomationMetadata(supabaseAdmin, booking.id, { receipt_processing_at: null, receipt_last_error: message })
      }
    } else {
      result.receipt = 'already-processing'
    }
  }

  return result
}
export default {
  // Database Webhooks send the Supabase secret API key in `apikey`.
  // `withSupabase` validates it and supplies the privileged client.
  fetch: withSupabase({ auth: 'secret' }, async (request, ctx) => {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed.' }, 405)
    }

    try {
      const payload = await request.json() as WebhookPayload
      const result = await processBooking(payload, ctx.supabaseAdmin)
      return json({ ok: true, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected automation error.'
      return json({ ok: false, error: message }, 500)
    }
  }),
}
