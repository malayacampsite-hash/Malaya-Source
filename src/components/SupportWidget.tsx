import { useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, Send, UserRound, X } from 'lucide-react'
import { faq } from '../data/siteContent'
import type { SupportMessage } from '../types'
import { addVisitorMessage, createSupportConversation, getSupportState, getVisitorMessages, setSupportMode, updateSupportVisitor } from '../services/supabase'

type Props = { open: boolean; onToggle: () => void }
type StoredConversation = { id: string; token: string }
type VisitorContact = { name: string; email: string; phone: string }
const STORAGE_KEY = 'malaya-support-conversation-v3'

function makeToken() { return `${crypto.randomUUID()}-${crypto.randomUUID()}-${Date.now()}` }

function validateContact(contact: VisitorContact) {
  const name = contact.name.trim()
  const email = contact.email.trim()
  const phone = contact.phone.trim()
  if (!name) return 'Enter your name to continue.'
  if (name.length > 120) return 'Your name must be 120 characters or fewer.'
  if (!email) return 'Enter your email address to continue.'
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
  const phoneDigits = phone.replace(/\D/g, '')
  if (!phone) return 'Enter your phone number to continue.'
  if (!/^\+?[\d\s().-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) return 'Enter a valid phone number.'
  return ''
}

function quickQuestionLabel(question: string) {
  const labels: Record<string, string> = {
    'How do I reserve?': 'Reservations',
    'Can I bring kids or extra guests?': 'Guest capacity',
    'Can I change my dates?': 'Change dates',
    'What is included?': 'What is included?',
    'Can I bring pets?': 'Pets',
  }
  return labels[question] ?? question
}

function mergeMessages(current: SupportMessage[], incoming: SupportMessage[]) {
  const unique = new Map(current.map(message => [message.id, message]))
  for (const message of incoming) unique.set(message.id, message)
  return [...unique.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function readStoredConversation(): StoredConversation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const candidate = value as Partial<StoredConversation>
    return typeof candidate.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate.id)
      && typeof candidate.token === 'string' && candidate.token.length >= 20 && candidate.token.length <= 200
      ? { id: candidate.id, token: candidate.token }
      : null
  } catch {
    return null
  }
}

function storeConversation(value: StoredConversation | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Keep the current support session usable when browser storage is disabled.
  }
}

export function SupportWidget({ open, onToggle }: Props) {
  const [conversation, setConversation] = useState<StoredConversation | null>(readStoredConversation)
  const conversationRef = useRef<StoredConversation | null>(conversation)
  const pendingConversationRef = useRef<Promise<StoredConversation> | null>(null)
  const [mode, setMode] = useState<'bot' | 'staff'>('bot')
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [savedContact, setSavedContact] = useState<VisitorContact>({ name: '', email: '', phone: '' })
  const [contactReady, setContactReady] = useState(false)
  const [editingContact, setEditingContact] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const actionBusyRef = useRef(false)

  const beginAction = () => {
    if (actionBusyRef.current) return false
    actionBusyRef.current = true
    setBusy(true)
    return true
  }

  const endAction = () => {
    actionBusyRef.current = false
    setBusy(false)
  }

  const staffHasReplied = messages.some(item => item.sender === 'staff')
  const contactFormVisible = !contactReady || editingContact

  const loadMessages = async (current: StoredConversation) => {
    const rows = await getVisitorMessages(current.id, current.token)
    if (conversationRef.current?.id !== current.id) return
    setMessages(existing => mergeMessages(existing, rows.map(row => ({ id: row.id, sender: row.sender, text: row.text, createdAt: row.created_at }))))
  }

  const ensureConversation = async () => {
    if (conversationRef.current) return conversationRef.current
    if (pendingConversationRef.current) return pendingConversationRef.current
    const pending = (async () => {
      const token = makeToken()
      const result = await createSupportConversation(token)
      const next = result[0] ? { id: result[0].id, token: result[0].visitor_token || token } : null
      if (!next) throw new Error('Support could not start a conversation.')
      conversationRef.current = next
      setConversation(next)
      storeConversation(next)
      return next
    })()
    pendingConversationRef.current = pending
    try {
      return await pending
    } finally {
      if (pendingConversationRef.current === pending) pendingConversationRef.current = null
    }
  }

  const replaceConversation = async (staleId: string) => {
    if (conversationRef.current && conversationRef.current.id !== staleId) return conversationRef.current
    conversationRef.current = null
    setConversation(null)
    storeConversation(null)
    setMessages([])
    setMode('bot')
    setSavedContact({ name: '', email: '', phone: '' })
    setContactReady(false)
    setEditingContact(true)
    return ensureConversation()
  }

  const refreshConversation = async (current: StoredConversation, hydrateContact = false) => {
    let active = current
    let state = await getSupportState(active.id, active.token)
    if (!state[0] || state[0].status === 'closed') {
      active = await replaceConversation(current.id)
      state = await getSupportState(active.id, active.token)
    }
    if (!state[0]) throw new Error('Support could not restore this conversation. Please try again.')
    setMode(state[0].mode)
    if (hydrateContact || active.id !== current.id) {
      const restoredContact = {
        name: state[0].visitor_name ?? '',
        email: state[0].visitor_email ?? '',
        phone: state[0].visitor_phone ?? '',
      }
      setName(restoredContact.name)
      setEmail(restoredContact.email)
      setPhone(restoredContact.phone)
      setSavedContact(restoredContact)
      const isComplete = !validateContact(restoredContact)
      setContactReady(isComplete)
      setEditingContact(!isComplete)
    }
    await loadMessages(active)
  }

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        setError('')
        const current = conversationRef.current
        if (!current) {
          setContactReady(false)
          setEditingContact(false)
          setMessages([])
          return
        }
        await refreshConversation(current, true)
      } catch (err) { setError(err instanceof Error ? err.message : 'Support is temporarily unavailable.') }
    })()
  }, [open])

  useEffect(() => {
    if (!open || !conversation) return
    const timer = window.setInterval(() => { void refreshConversation(conversation).catch(() => undefined) }, 3000)
    return () => window.clearInterval(timer)
  }, [open, conversation])

  const persistContact = async (current: StoredConversation) => {
    await updateSupportVisitor(current.id, current.token, { name: name.trim(), email: email.trim(), phone: phone.trim() })
  }

  const saveContact = async () => {
    const validationError = validateContact({ name, email, phone })
    if (validationError) { setError(validationError); return }
    if (!beginAction()) return
    setError('')
    try {
      const current = await ensureConversation()
      await persistContact(current)
      const nextSavedContact = { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() }
      setSavedContact(nextSavedContact)
      setName(nextSavedContact.name)
      setEmail(nextSavedContact.email)
      setPhone(nextSavedContact.phone)
      setContactReady(true)
      setEditingContact(false)
      await refreshConversation(current, true)
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not save your contact details.') }
    finally { endAction() }
  }

  const ask = async (question: string) => {
    if (!contactReady || editingContact || staffHasReplied || !beginAction()) return
    const answer = faq.find(item => item.q === question)?.a ?? 'I can help with booking, the cabin, and the Malaya experience.'
    setError('')
    try {
      const current = await ensureConversation()
      await addVisitorMessage(current.id, current.token, question, 'visitor')
      await addVisitorMessage(current.id, current.token, answer, 'bot')
      await loadMessages(current)
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not send that message.') }
    finally { endAction() }
  }

  const requestStaff = async () => {
    if (!contactReady || editingContact || mode === 'staff' || staffHasReplied || !beginAction()) return
    setError('')
    try {
      const current = await ensureConversation()
      await persistContact(current)
      await setSupportMode(current.id, current.token, 'staff')
      await addVisitorMessage(current.id, current.token, 'I would like to talk to a staff member.', 'visitor')
      await addVisitorMessage(current.id, current.token, 'You’re now in the staff queue. Leave your message below and a team member can reply here.', 'bot')
      setMode('staff')
      await loadMessages(current)
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not switch to staff support.') }
    finally { endAction() }
  }

  const send = async () => {
    const clean = message.trim()
    if (!contactReady || editingContact || !clean || !beginAction()) return
    setError('')
    try {
      const current = await ensureConversation()
      await persistContact(current)
      await addVisitorMessage(current.id, current.token, clean, 'visitor')
      if (!staffHasReplied) {
        const acknowledgement = mode === 'staff'
          ? 'I’ve shared your message with the Malaya team. I can still help with common questions while you wait.'
          : 'I’ve recorded your message. Ask another question, or choose “Talk to staff” when you’d like a person.'
        await addVisitorMessage(current.id, current.token, acknowledgement, 'bot')
      }
      await loadMessages(current)
      setMessage('')
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not send your message.') }
    finally { endAction() }
  }

  return <>
    <button className="support-launcher" onClick={onToggle} aria-expanded={open}><MessageCircle size={17} /><span>{open ? 'Close' : 'Guest support'}</span></button>
    {open ? <aside className="support-panel" aria-label="Guest support">
      <div className="support-head"><div><span className="support-badge"><span /> Live guest support</span><h3>How can we help?</h3></div><button className="support-close" onClick={onToggle} aria-label="Close"><X size={18} /></button></div>
      {contactFormVisible ? <form className="support-prechat" onSubmit={event => { event.preventDefault(); void saveContact() }}>
        <div className="support-prechat-copy"><span className="eyebrow">BEFORE YOU START</span><h4>How can we reach you?</h4><p>Please add your contact details before asking a question. They help our team follow up.</p></div>
        <label>Name<input autoComplete="name" value={name} onChange={event => { setName(event.target.value); setError('') }} maxLength={120} required /></label>
        <label>Email<input type="email" autoComplete="email" inputMode="email" value={email} onChange={event => { setEmail(event.target.value); setError('') }} maxLength={254} required /></label>
        <label>Phone number<input type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={event => { setPhone(event.target.value); setError('') }} maxLength={40} required /></label>
        {error ? <p className="support-error" role="alert">{error}</p> : null}
        <div className="support-prechat-actions"><button className="support-prechat-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Continue to chat'}</button>{contactReady ? <button className="support-prechat-cancel" type="button" onClick={() => { setName(savedContact.name); setEmail(savedContact.email); setPhone(savedContact.phone); setEditingContact(false); setError('') }}>Cancel</button> : null}</div>
      </form> : <>
        <div className="support-mode">
          <span>{staffHasReplied ? <><UserRound size={13} /> Staff is replying</> : mode === 'staff' ? <><Bot size={13} /> Staff requested · assistant available</> : <><Bot size={13} /> Assistant</>}</span>
          <div className="support-mode-actions">{!staffHasReplied && mode === 'bot' ? <button type="button" disabled={busy} onClick={() => void requestStaff()}>Talk to staff</button> : !staffHasReplied ? <button type="button" disabled>Staff requested</button> : null}<button type="button" className="support-edit-contact" onClick={() => { setEditingContact(true); setError('') }}>Edit details</button></div>
        </div>
        <div className="support-messages" aria-live="polite">{messages.map(m => <div key={m.id} className={`support-message ${m.sender}`}><small>{m.sender === 'visitor' ? 'You' : m.sender === 'bot' ? 'Malaya assistant' : 'Malaya staff'}</small><span>{m.text}</span></div>)}</div>
        {!staffHasReplied ? <div className="faq-row" role="group" aria-label="Suggested questions">{faq.filter(item => item.q !== 'Can I talk to a person?').map(item => <button type="button" key={item.q} title={item.q} aria-label={item.q} onClick={() => void ask(item.q)} disabled={busy}>{quickQuestionLabel(item.q)}</button>)}</div> : null}
        {error ? <p className="support-error" role="alert">{error}</p> : null}
        <form className="support-composer" onSubmit={event => { event.preventDefault(); void send() }}>
          <input aria-label="Message" placeholder={staffHasReplied ? 'Message Malaya staff…' : mode === 'staff' ? 'Ask a question while you wait…' : 'Ask a question…'} value={message} onChange={event => setMessage(event.target.value)} maxLength={2000} />
          <button type="submit" disabled={busy || !message.trim()} aria-label="Send"><Send size={15} /></button>
        </form>
        <p className="support-foot">{staffHasReplied ? 'You’re now chatting with Malaya staff.' : mode === 'staff' ? 'A team member can reply here. The assistant remains available until they join.' : 'You can ask a quick question or send a message to our team.'}</p>
      </>}
    </aside> : null}
  </>
}
