import { useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, Send, UserRound, X } from 'lucide-react'
import { faq } from '../data/siteContent'
import type { SupportMessage } from '../types'
import { addVisitorMessage, createSupportConversation, getSupportState, getVisitorMessages, setSupportMode, updateSupportVisitor } from '../services/supabase'

type Props = { open: boolean; onToggle: () => void }
type StoredConversation = { id: string; token: string }
const STORAGE_KEY = 'malaya-support-conversation-v3'

function makeToken() { return `${crypto.randomUUID()}-${crypto.randomUUID()}-${Date.now()}` }

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

  const loadMessages = async (current: StoredConversation) => {
    const rows = await getVisitorMessages(current.id, current.token)
    setMessages(rows.map(row => ({ id: row.id, sender: row.sender, text: row.text, createdAt: row.created_at })))
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
      setName(state[0].visitor_name ?? '')
      setEmail(state[0].visitor_email ?? '')
      setPhone(state[0].visitor_phone ?? '')
    }
    await loadMessages(active)
  }

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        setError('')
        const current = await ensureConversation()
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
    if (name.trim() || email.trim() || phone.trim()) await updateSupportVisitor(current.id, current.token, { name: name.trim(), email: email.trim(), phone: phone.trim() })
  }

  const ask = async (question: string) => {
    if (!beginAction()) return
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
    if (!beginAction()) return
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
    if (!clean || !beginAction()) return
    setError('')
    try {
      const current = await ensureConversation()
      await persistContact(current)
      await addVisitorMessage(current.id, current.token, clean, 'visitor')
      if (mode === 'bot') await addVisitorMessage(current.id, current.token, 'I’ve recorded that. Ask another question or choose “Talk to staff” when you’d like a person.', 'bot')
      await loadMessages(current)
      setMessage('')
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not send your message.') }
    finally { endAction() }
  }

  return <>
    <button className="support-launcher" onClick={onToggle} aria-expanded={open}><MessageCircle size={17} /><span>{open ? 'Close' : 'Guest support'}</span></button>
    {open ? <aside className="support-panel" aria-label="Guest support">
      <div className="support-head"><div><span className="support-badge"><span /> Live guest support</span><h3>How can we help?</h3></div><button className="support-close" onClick={onToggle} aria-label="Close"><X size={18} /></button></div>
      <div className="support-mode"><span>{mode === 'bot' ? <><Bot size={13} /> Assistant</> : <><UserRound size={13} /> Staff queue</>}</span><button disabled={busy || mode === 'staff'} onClick={() => void requestStaff()}>{mode === 'bot' ? 'Talk to staff' : 'Staff requested'}</button></div>
      <div className="support-messages">{messages.map(m => <div key={m.id} className={`support-message ${m.sender}`}><small>{m.sender === 'visitor' ? 'You' : m.sender === 'bot' ? 'Malaya assistant' : 'Malaya staff'}</small><span>{m.text}</span></div>)}</div>
      {mode === 'bot' ? <div className="faq-row">{faq.map(item => <button key={item.q} onClick={() => void ask(item.q)} disabled={busy}>{item.q}</button>)}</div> : <div className="support-details"><input placeholder="Name" value={name} onChange={e => setName(e.target.value)} maxLength={120} /><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} /><input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} /></div>}
      {error ? <p className="support-error">{error}</p> : null}
      <div className="support-composer"><input placeholder={mode === 'staff' ? 'Write to the team…' : 'Ask a question…'} value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} onKeyDown={e => { if (e.key === 'Enter') void send() }} /><button onClick={() => void send()} disabled={busy || !message.trim()} aria-label="Send"><Send size={15} /></button></div>
      <p className="support-foot">Your conversation is securely recorded in Supabase so staff can continue where the assistant left off.</p>
    </aside> : null}
  </>
}
