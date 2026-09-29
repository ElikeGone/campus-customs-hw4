import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { formatPrice, type ChatHistory, type ChatReply, type PageContext, type ProductCard } from '../api'
import { useAuth, type User } from '../auth'
import { onOpenChat } from '../chatEvents'
import { ChatIcon, CloseIcon, SendIcon } from './Icons'
import { Crest } from './Logo'

// Starter questions shown until the shopper sends their first message.
const SUGGESTIONS = ['What hoodies do you have?', 'Gift ideas for a Yale parent', "What's under $50?"]
const PRODUCT_PAGE_SUGGESTIONS = ['Is this in stock in medium?', 'What colors does this come in?', 'Show me similar items']

interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
  products?: ProductCard[]
  // A canned reply because the assistant couldn't answer normally.
  fallback?: boolean
}

function greeting(user: User | null): Message {
  return {
    role: 'assistant',
    content: user
      ? `Hi ${user.first_name || user.name}! I'm the Campus Customs assistant. How can I help you today?`
      : "Hi! I'm the Campus Customs assistant. How can I help you today? Log in to save our conversation for next time.",
  }
}

// Which product (if any) the shopper is looking at, sent with each message.
function pageContext(pathname: string): PageContext {
  const match = pathname.match(/^\/products\/([^/]+)$/)
  return { path: pathname, product_id: match ? decodeURIComponent(match[1]) : null }
}

// A little longer than the backend's own 60s limit, so a stuck request can't leave "Typing…" forever.
const CHAT_TIMEOUT_MS = 75_000

async function sendToAgent(message: string, page: PageContext): Promise<ChatReply> {
  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, page }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    })
  } catch (err) {
    throw new Error(
      (err as Error).name === 'TimeoutError'
        ? 'The assistant is taking too long to respond. Please try again.'
        : "Couldn't reach the assistant. Check your connection and try again.",
    )
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (typeof data?.detail === 'string') throw new Error(data.detail)
    throw new Error(
      res.status >= 500
        ? "The assistant is unavailable right now. Please try again in a moment, or browse the Products page."
        : 'Something went wrong. Please try again.',
    )
  }
  return data as ChatReply
}

// The session cookie decides whose history this is; logged-out shoppers get none.
async function fetchHistory(): Promise<Message[]> {
  const res = await fetch('/api/chat/history')
  if (!res.ok) return []
  const data = (await res.json()) as ChatHistory
  return data.messages.map((m) => ({ role: m.role, content: m.content, products: m.products }))
}

function ProductPanel({ products, onClose }: { products: ProductCard[]; onClose: () => void }) {
  return (
    <aside className="chat-products" aria-label="Matching products">
      <div className="chat-products-header">
        <span>
          <span className="eyebrow varsity light">From the shop</span>
          {products.length} matching product{products.length === 1 ? '' : 's'}
        </span>
        <button className="chat-close" aria-label="Hide products" onClick={onClose}>
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="chat-products-list">
        {products.map((p) => (
          <Link key={p.product_id} to={`/products/${p.product_id}`} className="chat-card">
            <img src={p.image_url} alt={p.name} loading="lazy" />
            <div className="chat-card-info">
              <span className="chat-card-name">{p.name}</span>
              <span className="chat-card-price">{formatPrice(p.price)}</span>
              <span className="chat-card-type">{p.garment_type}</span>
              <span className="chat-card-desc">{p.short_description}</span>
            </div>
          </Link>
        ))}
      </div>
    </aside>
  )
}

export default function ChatWidget() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([greeting(null)])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // Products currently shown in the panel next to the chat.
  const [shownProducts, setShownProducts] = useState<ProductCard[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Whose conversation is on screen (user id, or null for a guest). A reply that arrives after
  // the shopper logged in or out belongs to the previous conversation and is dropped.
  const ownerRef = useRef<number | null>(null)

  // Load the shopper's saved conversation when they log in; clear it when they log out,
  // so the next person on this browser never sees it. Guest chats are never saved or merged.
  useEffect(() => {
    if (loading) return
    ownerRef.current = user?.id ?? null
    let cancelled = false
    const load = user ? fetchHistory() : Promise.resolve([])
    load.then((history) => {
      if (cancelled) return
      setMessages([greeting(user), ...history])
      setShownProducts([])
    })
    return () => {
      cancelled = true
    }
  }, [user, loading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, sending, open])

  // Other pages can open the chat, optionally with a question typed in for the shopper to send.
  useEffect(
    () =>
      onOpenChat((prompt) => {
        setOpen(true)
        if (prompt) setInput(prompt)
        setTimeout(() => inputRef.current?.focus(), 50)
      }),
    [],
  )

  const send = (e: FormEvent) => {
    e.preventDefault()
    void sendText(input)
  }

  const sendText = async (raw: string) => {
    const text = raw.trim()
    if (!text || sending) return
    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    setSending(true)
    const owner = ownerRef.current
    try {
      const { reply, products, fallback } = await sendToAgent(text, pageContext(location.pathname))
      if (ownerRef.current !== owner) return
      setMessages((m) => [...m, { role: 'assistant', content: reply, products, fallback }])
      if (products.length > 0) setShownProducts(products)
    } catch (err) {
      if (ownerRef.current !== owner) return
      setMessages((m) => [...m, { role: 'error', content: (err as Error).message }])
    } finally {
      setSending(false)
    }
  }

  const onProductPage = pageContext(location.pathname).product_id !== null
  const showSuggestions = !sending && !messages.some((m) => m.role === 'user')

  return (
    <div className={open ? 'chat open' : 'chat'}>
      {open && (
        <div className="chat-row">
          {shownProducts.length > 0 && (
            <ProductPanel products={shownProducts} onClose={() => setShownProducts([])} />
          )}
          <div className="chat-panel" role="dialog" aria-label="Chat with Campus Customs">
            <div className="chat-header">
              <Crest size={34} />
              <div className="chat-title">
                <span>Campus Customs Assistant</span>
                <small>
                  <span className="status-dot" aria-hidden="true" /> Checks real sizes &amp; stock
                </small>
              </div>
              <button className="chat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="chat-messages" aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}${m.fallback ? ' notice' : ''}`}>
                  {m.content}
                  {m.products && m.products.length > 0 && (
                    <>
                      <div className="chat-inline-cards">
                        {m.products.map((p) => (
                          <Link
                            key={p.product_id}
                            to={`/products/${p.product_id}`}
                            className="chat-inline-card"
                            title={p.short_description}
                          >
                            <img src={p.image_url} alt={p.name} loading="lazy" />
                            <span className="chat-inline-name">{p.name}</span>
                            <span className="chat-card-price">{formatPrice(p.price)}</span>
                          </Link>
                        ))}
                      </div>
                      <button
                        className="chat-show-products"
                        onClick={() => setShownProducts(m.products ?? [])}
                        disabled={shownProducts === m.products}
                      >
                        {shownProducts === m.products ? 'Shown in panel' : 'Show in panel'}
                      </button>
                    </>
                  )}
                </div>
              ))}
              {sending && (
                <div className="chat-msg assistant typing" aria-label="Assistant is typing">
                  <span className="typing-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
              {showSuggestions && (
                <div className="chat-suggestions">
                  {(onProductPage ? PRODUCT_PAGE_SUGGESTIONS : SUGGESTIONS).map((q) => (
                    <button key={q} className="prompt-chip" onClick={() => void sendText(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <form className="chat-input" onSubmit={send}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about styles, sizes, or stock…"
                aria-label="Message"
                maxLength={2000}
              />
              <button type="submit" aria-label="Send" disabled={sending || !input.trim()}>
                <SendIcon size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
      <button
        className={open ? 'chat-toggle is-open' : 'chat-toggle'}
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <CloseIcon size={22} /> : <ChatIcon size={22} />}
        {!open && <span className="chat-toggle-label">Ask us</span>}
      </button>
    </div>
  )
}
