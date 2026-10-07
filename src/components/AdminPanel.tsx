import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, Check, ChevronRight, Inbox, LogOut, MessageSquareText, RefreshCw, Search, Send, Settings2, X } from 'lucide-react'
import { accommodation } from '../data/siteContent'
import {
  closeConversation,
  getSiteSetting,
  isSupabaseConfigured,
  listBookings,
  listConversationMessages,
  listConversations,
  saveDailyMessage,
  sendStaffMessage,
  signInAdmin,
  signOutAdmin,
  supabase,
  updateBookingStatus,
  verifyAdmin,
  type AdminConversation,
  type AdminMessage,
  type SupabaseAdminBooking,
} from '../services/supabase'
import type { Session } from '@supabase/supabase-js'
import type { BookingStatus } from '../types'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function stayName(id: string) { return accommodation.find(item => item.id === id)?.name ?? id }

export function AdminPanel() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState<'bookings' | 'support' | 'settings'>('bookings')
  const [bookings, setBookings] = useState<SupabaseAdminBooking[]>([])
  const [conversations, setConversations] = useState<AdminConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState('')
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all')
  const [dailyMessage, setDailyMessage] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setBooting(false); return }
    let mounted = true
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session)
        if (data.session) setAuthorized(await verifyAdmin())
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Could not initialize admin access.')
      } finally { if (mounted) setBooting(false) }
    })()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) setAuthorized(false)
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session || !authorized) return
    void refreshAll()
  }, [session, authorized])

  useEffect(() => {
    if (!session || !authorized || !selectedConversation) return
    void loadConversationMessages(selectedConversation)
  }, [selectedConversation, session, authorized])

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings.filter(item => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const haystack = `${item.full_name} ${item.email} ${item.phone} ${item.booking_reference} ${stayName(item.accommodation_id)}`.toLowerCase()
      return matchesStatus && (!q || haystack.includes(q))
    })
  }, [bookings, search, statusFilter])

  const activeConversation = conversations.find(item => item.id === selectedConversation) ?? null

  async function refreshAll() {
    if (!supabase || !authorized) return
    setBusy(true); setError(''); setNotice('')
    try {
      const [bookingRows, conversationRows, setting] = await Promise.all([
        listBookings(session ?? undefined),
        listConversations(),
        getSiteSetting('daily_message'),
      ])
      setBookings(bookingRows)
      setConversations(conversationRows)
      if (setting) setDailyMessage(setting)
      if (!selectedConversation && conversationRows[0]) setSelectedConversation(conversationRows[0].id)
      else if (selectedConversation && !conversationRows.some(item => item.id === selectedConversation)) setSelectedConversation(conversationRows[0]?.id ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh admin data.')
    } finally { setBusy(false) }
  }

  async function loadConversationMessages(id: string) {
    try { setMessages(await listConversationMessages(id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load conversation.') }
  }

  async function handleSignIn(email: string, password: string) {
    setBusy(true); setError('')
    try {
      const next = await signInAdmin(email.trim(), password)
      if (!next) throw new Error('No active Supabase session was created.')
      const isAdmin = await verifyAdmin()
      if (!isAdmin) { await signOutAdmin(); throw new Error('This account is not authorized for the Malaya staff workspace.') }
      setAuthorized(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.') }
    finally { setBusy(false) }
  }

  async function changeBookingStatus(id: string, status: BookingStatus) {
    setBusy(true); setError(''); setNotice('')
    try {
      await updateBookingStatus(id, status)
      setBookings(current => current.map(item => item.id === id ? { ...item, status } : item))
      setNotice('Booking status updated.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update booking.') }
    finally { setBusy(false) }
  }

  async function sendReply() {
    if (!activeConversation || !reply.trim()) return
    setBusy(true); setError(''); setNotice('')
    try {
      await sendStaffMessage(activeConversation.id, reply, session?.user.email)
      await loadConversationMessages(activeConversation.id)
      setConversations(current => current.map(item => item.id === activeConversation.id ? { ...item, mode: 'staff', updated_at: new Date().toISOString() } : item))
      setReply('')
      setNotice('Reply sent to the visitor.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send reply.') }
    finally { setBusy(false) }
  }

  async function handleCloseConversation() {
    if (!activeConversation) return
    setBusy(true); setError('')
    try {
      await closeConversation(activeConversation.id)
      setConversations(current => current.map(item => item.id === activeConversation.id ? { ...item, status: 'closed' } : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not close conversation.') }
    finally { setBusy(false) }
  }

  async function handleSaveMessage() {
    setBusy(true); setError(''); setNotice('')
    try { await saveDailyMessage(dailyMessage); setNotice('Homepage message saved.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save homepage message.') }
    finally { setBusy(false) }
  }

  if (booting) return <div className="admin-screen"><div className="admin-loading">Opening staff workspace…</div></div>
  if (!isSupabaseConfigured()) return <div className="admin-screen auth-screen"><div className="auth-layout"><div className="auth-story"><span className="eyebrow eyebrow-light">MALAYA CAMPSITE</span><h1>Connect Supabase. Run the stay.</h1><p>This workspace is intentionally dependent on the campsite’s Supabase project for bookings, conversations, authentication, and site content.</p><a className="back-home" href="/">← Return to the website</a></div><div className="admin-auth-card"><span className="eyebrow">SETUP REQUIRED</span><h2>Supabase not configured.</h2><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your environment variables.</p></div></div></div>
  if (!session) return <AdminLogin onSubmit={handleSignIn} busy={busy} error={error} />
  if (!authorized) return <div className="admin-screen auth-screen"><div className="auth-layout"><div className="auth-story"><span className="eyebrow eyebrow-light">MALAYA CAMPSITE</span><h1>This account can sign in. It cannot operate the site.</h1><p>Add the authenticated user’s UUID to the <code>admin_users</code> table in Supabase, then return here.</p><a className="back-home" href="/">← Return to website</a></div><div className="admin-auth-card"><span className="eyebrow">ACCESS DENIED</span><h2>Not authorized.</h2><p>{session.user.email}</p><button className="button button-primary" onClick={() => void signOutAdmin()}>Sign out</button></div></div></div>

  const pending = bookings.filter(item => item.status === 'pending').length
  const confirmed = bookings.filter(item => item.status === 'confirmed').length
  const openConversations = conversations.filter(item => item.status === 'open').length

  return <div className="admin-screen">
    <header className="admin-header">
      <a className="admin-brand" href="/"><img src="/images/logo.png" alt="Malaya Campsite" /><span>Staff workspace</span></a>
      <div className="admin-header-actions"><a className="admin-site-link" href="/">Open public site <ChevronRight size={13} /></a><button className="admin-icon-button" onClick={() => void refreshAll()} disabled={busy} aria-label="Refresh"><RefreshCw size={15} className={busy ? 'spin' : ''} /></button><button className="admin-icon-button" onClick={() => void signOutAdmin()} aria-label="Sign out"><LogOut size={15} /></button></div>
    </header>

    <main className="admin-content">
      <div className="admin-intro"><div><span className="eyebrow">MALAYA / OPERATIONS</span><h1>Know what needs attention.</h1><p>A focused workspace for reservation requests, guest conversations, and the message visitors see on the homepage.</p></div><span className="admin-user">{session.user.email}</span></div>
      {error ? <div className="admin-alert"><X size={14} />{error}</div> : null}
      {notice ? <div className="admin-notice"><Check size={14} />{notice}</div> : null}

      <section className="admin-metrics">
        <Metric label="Pending bookings" value={pending} icon={<CalendarDays size={16} />} />
        <Metric label="Confirmed" value={confirmed} icon={<Check size={16} />} />
        <Metric label="Open conversations" value={openConversations} icon={<MessageSquareText size={16} />} />
        <Metric label="Total requests" value={bookings.length} icon={<Inbox size={16} />} />
      </section>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}><CalendarDays size={14} /> Bookings</button>
        <button className={tab === 'support' ? 'active' : ''} onClick={() => setTab('support')}><MessageSquareText size={14} /> Customer service</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings2 size={14} /> Homepage message</button>
      </nav>

      {tab === 'bookings' ? <section className="admin-section">
        <div className="admin-section-head"><div><span className="eyebrow">RESERVATIONS</span><h2>Booking requests</h2></div><span className="admin-muted">{filteredBookings.length} shown</span></div>
        <div className="booking-tools"><label><Search size={13} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest, reference, stay…" /></label><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option><option value="completed">Completed</option></select></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Guest</th><th>Stay</th><th>Dates</th><th>Contact</th><th>Request</th><th>Status</th></tr></thead><tbody>{filteredBookings.map(item => <tr key={item.id}><td><strong>{item.full_name}</strong><span>{item.guests} guest{item.guests === 1 ? '' : 's'}</span></td><td><strong>{stayName(item.accommodation_id)}</strong><span>{item.preferred_arrival ? `Arrival ${item.preferred_arrival}` : 'Arrival time not specified'}</span></td><td><strong>{formatDate(item.check_in)}</strong><span>→ {formatDate(item.check_out)}</span></td><td><span>{item.email}</span><span>{item.phone}</span></td><td><strong>{item.booking_reference}</strong><span>{formatDateTime(item.created_at)}</span>{item.notes ? <span className="cell-note">{item.notes}</span> : null}</td><td><select className="status-select" value={item.status} onChange={e => void changeBookingStatus(item.id, e.target.value as BookingStatus)} disabled={busy}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option><option value="completed">Completed</option></select></td></tr>)}</tbody></table>{filteredBookings.length === 0 ? <div className="admin-empty">No booking requests match your current filters.</div> : null}</div>
      </section> : null}

      {tab === 'support' ? <section className="admin-section">
        <div className="admin-section-head"><div><span className="eyebrow">GUEST MESSAGES</span><h2>Customer service</h2></div><span className="admin-muted">{openConversations} open</span></div>
        <div className="support-admin-layout"><aside className="conversation-list">{conversations.map(item => <button key={item.id} className={selectedConversation === item.id ? 'selected' : ''} onClick={() => setSelectedConversation(item.id)}><div><strong>{item.visitor_name || 'Guest visitor'}</strong><small>{item.visitor_email || item.visitor_phone || 'Contact details not added'}</small></div><div className="conversation-meta"><span className={item.status === 'open' ? 'live' : ''}>{item.mode === 'staff' ? 'Staff' : 'Assistant'}</span><time>{formatDateTime(item.updated_at)}</time></div></button>)}{conversations.length === 0 ? <div className="admin-empty">No conversations yet.</div> : null}</aside><div className="conversation-detail">{activeConversation ? <><div className="conversation-head"><div><span className="eyebrow">{activeConversation.mode === 'staff' ? 'STAFF HANDOFF' : 'ASSISTANT FIRST'}</span><h3>{activeConversation.visitor_name || 'Guest visitor'}</h3><p>{activeConversation.visitor_email || 'No email'} · {activeConversation.visitor_phone || 'No phone'}</p></div><div className="conversation-actions"><span className={activeConversation.status === 'open' ? 'status-pill green' : 'status-pill'}>{activeConversation.status}</span>{activeConversation.status === 'open' ? <button className="button button-quiet" onClick={() => void handleCloseConversation()} disabled={busy}>Close</button> : null}</div></div><div className="admin-messages">{messages.map(item => <div key={item.id} className={`admin-message ${item.sender}`}><small>{item.sender === 'visitor' ? 'Guest' : item.sender === 'bot' ? 'Assistant' : item.admin_name || 'Staff'}</small><p>{item.text}</p><time>{formatDateTime(item.created_at)}</time></div>)}</div>{activeConversation.status === 'open' ? <div className="admin-reply"><textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to the guest…" rows={3} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void sendReply() }} /><button className="button button-primary" disabled={busy || !reply.trim()} onClick={() => void sendReply()}><Send size={14} /> Send</button></div> : null}</> : <div className="admin-empty detail-empty">Select a conversation to review the recorded thread.</div>}</div></div>
      </section> : null}

      {tab === 'settings' ? <section className="admin-section"><div className="admin-section-head"><div><span className="eyebrow">LIVE CONTENT</span><h2>Homepage message</h2></div><span className="admin-muted">Published to the public site</span></div><div className="settings-card"><p>Change the short message shown on the homepage without redeploying the site.</p><textarea value={dailyMessage} onChange={e => setDailyMessage(e.target.value)} rows={5} /><div className="settings-actions"><span>{notice || 'Keep it brief and useful.'}</span><button className="button button-primary" onClick={() => void handleSaveMessage()} disabled={busy}>Save message</button></div></div></section> : null}
    </main>
  </div>
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="metric"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>
}

function AdminLogin({ onSubmit, busy, error }: { onSubmit: (email: string, password: string) => Promise<void>; busy: boolean; error: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const submit = (event: FormEvent) => { event.preventDefault(); void onSubmit(email, password) }
  return <div className="admin-screen auth-screen"><div className="auth-layout"><div className="auth-story"><span className="eyebrow eyebrow-light">MALAYA CAMPSITE</span><h1>A quieter way to run the day.</h1><p>Bookings and guest conversations from one staff workspace, with Supabase handling authentication and data.</p><a className="back-home" href="/">← Return to website</a></div><form className="admin-auth-card" onSubmit={submit}><span className="eyebrow">STAFF ACCESS</span><h2>Sign in.</h2><p>Use the staff account created in Supabase Authentication.</p><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>{error ? <p className="form-error">{error}</p> : null}<button className="button button-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to admin'}</button><p className="auth-foot">Authorization is enforced by the <code>admin_users</code> table and Supabase RLS.</p></form></div></div>
}
