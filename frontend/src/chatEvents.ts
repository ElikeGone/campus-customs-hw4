// Lets any page open the chat widget (optionally with a suggested message typed in).
const OPEN_CHAT_EVENT = 'cc:open-chat'

export function openChat(prompt?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(OPEN_CHAT_EVENT, { detail: prompt }))
}

export function onOpenChat(handler: (prompt?: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string | undefined>).detail)
  window.addEventListener(OPEN_CHAT_EVENT, listener)
  return () => window.removeEventListener(OPEN_CHAT_EVENT, listener)
}
