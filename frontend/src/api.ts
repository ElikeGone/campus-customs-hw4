export interface Product {
  product_id: string
  name: string
  garment_type: string
  category: string
  description: string
  colors: string[]
  image_url: string
  price: number
}

// The list endpoint also says which sizes are in stock, for the size filter.
export interface ProductListItem extends Product {
  sizes_in_stock: string[]
}

export interface SizeStock {
  size: string
  quantity: number
}

export interface ProductDetail extends Product {
  inventory: SizeStock[]
  total_stock: number
}

export class NotFoundError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error("We couldn't reach the store. Check your connection and try again.")
  }
  if (res.status === 404) throw new NotFoundError('Product not found.')
  if (!res.ok) throw new Error('Something went wrong loading this page. Please try again.')
  return res.json()
}

export const fetchProducts = () => getJson<ProductListItem[]>('/api/products')

export const fetchProduct = (id: string) =>
  getJson<ProductDetail>(`/api/products/${encodeURIComponent(id)}`)

export const formatPrice = (price: number) => `$${price.toFixed(2)}`

// Mirrors backend/models.py (ProductCard, ChatReply).
export interface ProductCard {
  product_id: string
  name: string
  garment_type: string
  price: number
  image_url: string
  short_description: string
}

export interface ChatReply {
  reply: string
  products: ProductCard[]
  // True when the assistant couldn't answer normally (error, timeout, or limits reached).
  fallback: boolean
}

export interface PageContext {
  path: string
  product_id: string | null
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  products: ProductCard[]
  created_at: string
}

export interface ChatHistory {
  messages: ChatHistoryMessage[]
}
