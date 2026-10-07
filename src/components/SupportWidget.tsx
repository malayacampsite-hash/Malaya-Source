import { useEffect, useState } from 'react'
import { Bot, MessageCircle, Send, UserRound, X } from 'lucide-react'
import { faq } from '../data/siteContent'
import type { SupportMessage } from '../types'
import { addVisitorMessage, createSupportConversation, getSupportState, getVisitorMessages, setSupportMode, updateSupportVisitor } from '../services/supabase'

type Props = { open: boolean; onToggle: () => void }
type StoredConversation = { id: string; token: string }
const STORAGE_KEY = 'malaya-support-conversation-v3'

function makeToken() { return `${crypto.randomUUID()}-${crypto.randomUUID()}-${Date.now()}` }

export function SupportWidget({ open, onToggle }: Props) {
  const [conversation, setConversation] = useState<StoredConversation | null>(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as StoredConversation : null } catch { return null }
  })
  const [mode, setMode] = useState<'bot' | 'staff'>('bot')
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadMessages = async (current: StoredConversation) => {
    const rows = await getVisitorMessages(current.id, current.token)
    setMessages(rows.map(row => ({ id: row.id, sender: row.sender, text: row.text, createdAt: row.created_at })))
  }

  const ensureConversation = async () => {
    if (conversation) return conversation
    const token = makeToken()
    const result = await createSupportConversation(token)
    const next = result[0] ? { id: result[0].id, token: result[0].visitor_token || token } : null
    if (!next) throw new Error('Support could not start a conversation.')
    setConversation(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  }

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        setError('')
        const current = await ensureConversation()
        const state = await getSupportState(current.id, current.token)
        if (state[0]) {
          setMode(state[0].mode)
          setName(state[0].visitor_name ?? '')
          setEmail(state[0].visitor_email ?? '')
          setPhone(state[0].visitor_phone ?? '')
        }
        await loadMessages(current)
      } catch (err) { setError(err instanceof Error ? err.message : 'Support is temporarily unavailable.') }
    })()
  }, [open])

  useEffect(() => {
    if (!open || !conversation) return
    const timer = window.setInterval(() => { void loadMessages(conversation).catch(() => undefined) }, 3000)
    return () => window.clearInterval(timer)
  }, [open, conversation])

  const persistContact = async (current: StoredConversation) => {
    if (name.trim() || email.trim() || phone.trim()) await updateSupportVisitor(current.id, current.token, { name: name.trim(), email: email.trim(), phone: phone.trim() })
  }

  const ask = async (question: string) => {
    if (busy) return
    const answer = faq.find(item => item.q === question)?.a ?? 'I can help with booking, the cabin, and the Malaya experience.'
    setBusy(true); setError('')
    try {
      const current = await ensureConversation()
      await addVisitorMessage(current.id, current.token, question, 'visitor')
      await addVisitorMessage(current.id, current.token, answer, 'bot')
      await loadMessages(current)
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not send that message.') }
    finally { setBusy(false) }
  }

  const requestStaff = async () => {
    setBusy(true); setError('')
    try {
      const current = await ensureConversation()
      await persistContact(current)
      await setSupportMode(current.id, current.token, 'staff')
      await addVisitorMessage(current.id, current.token, 'I would like to talk to a staff member.', 'visitor')
      await addVisitorMessage(current.id, current.token, 'You’re now in the staff queue. Leave your message below and a team member can reply here.', 'bot')
      setMode('staff')
      await loadMessages(current)
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not switch to staff support.') }
    finally { setBusy(false) }
  }

  const send = async () => {
    const clean = message.trim()
    if (!clean || busy) return
    setBusy(true); setError('')
    try {
      const current = await ensureConversation()
      await persistContact(current)
      await addVisitorMessage(current.id, current.token, clean, 'visitor')
      if (mode === 'bot') await addVisitorMessage(current.id, current.token, 'I’ve recorded that. Ask another question or choose “Talk to staff” when you’d like a person.', 'bot')
      await loadMessages(current)
      setMessage('')
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not send your message.') }
    finally { setBusy(false) }
  }

  return <>
    <button className="support-launcher" onClick={onToggle} aria-expanded={open}><MessageCircle size={17} /><span>{open ? 'Close' : 'Guest support'}</span></button>
    {open ? <aside className="support-panel" aria-label="Guest support">
      <div className="support-head"><div><span className="support-badge"><span /> Live guest support</span><h3>How can we help?</h3></div><button className="support-close" onClick={onToggle} aria-label="Close"><X size={18} /></button></div>
      <div className="support-mode"><span>{mode === 'bot' ? <><Bot size={13} /> Assistant</> : <><UserRound size={13} /> Staff queue</>}</span><button disabled={busy || mode === 'staff'} onClick={() => void requestStaff()}>{mode === 'bot' ? 'Talk to staff' : 'Staff requested'}</button></div>
      <div className="support-messages">{messages.map(m => <div key={m.id} className={`support-message ${m.sender}`}><small>{m.sender === 'visitor' ? 'You' : m.sender === 'bot' ? 'Malaya assistant' : 'Malaya staff'}</small><span>{m.text}</span></div>)}</div>
      {mode === 'bot' ? <div className="faq-row">{faq.map(item => <button key={item.q} onClick={() => void ask(item.q)} disabled={busy}>{item.q}</button>)}</div> : <div className="support-details"><input placeholder="Name" value={name} onChange={e => setName(e.target.value)} /><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} /></div>}
      {error ? <p className="support-error">{error}</p> : null}
      <div className="support-composer"><input placeholder={mode === 'staff' ? 'Write to the team…' : 'Ask a question…'} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void send() }} /><button onClick={() => void send()} disabled={busy || !message.trim()} aria-label="Send"><Send size={15} /></button></div>
      <p className="support-foot">Your conversation is securely recorded in Supabase so staff can continue where the assistant left off.</p>
    </aside> : null}
  </>
}
