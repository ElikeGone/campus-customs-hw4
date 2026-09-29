import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchProducts, type ProductListItem } from '../api'
import { SHOP_CATEGORIES } from '../catalog'
import { openChat } from '../chatEvents'
import { ChatIcon, CloseIcon, SearchIcon } from '../components/Icons'
import ProductTile, { ProductTileSkeleton } from '../components/ProductTile'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const PRICE_LIMITS = [40, 60, 80, 100]
const SORTS = {
  name: 'A–Z',
  price_asc: 'Price: low',
  price_desc: 'Price: high',
} as const
type SortKey = keyof typeof SORTS

const FILTER_KEYS = ['q', 'category', 'size', 'max', 'sort']

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
}

// Every search word must appear somewhere in the product's text.
function matchesSearch(p: ProductListItem, query: string): boolean {
  const q = words(query)
  if (q.length === 0) return true
  const text = new Set(words([p.name, p.garment_type, p.category, p.description, ...p.colors].join(' ')))
  return q.every((w) => text.has(w) || [...text].some((t) => t.startsWith(w)))
}

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [attempt, setAttempt] = useState(0)
  // Keyed by attempt so a retry shows the loading state again without resetting state in the effect.
  const [result, setResult] = useState<{ attempt: number; products?: ProductListItem[]; error?: string } | null>(null)

  useEffect(() => {
    fetchProducts()
      .then((products) => setResult({ attempt, products }))
      .catch((e: Error) => setResult({ attempt, error: e.message }))
  }, [attempt])

  const current = result?.attempt === attempt ? result : null
  const products = current?.products
  const error = current?.error

  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const size = params.get('size') ?? ''
  const max = Number(params.get('max')) || 0
  const sort = (params.get('sort') as SortKey) in SORTS ? (params.get('sort') as SortKey) : 'name'
  const hasFilters = FILTER_KEYS.some((k) => params.get(k))

  // Build on the browser's current URL (not this render's copy) so quick successive changes
  // don't drop each other.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(window.location.search)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true })

  const filtered = useMemo(() => {
    if (!products) return []
    const list = products.filter(
      (p) =>
        matchesSearch(p, q) &&
        (!category || p.category === category) &&
        (!size || p.sizes_in_stock.includes(size)) &&
        (!max || p.price <= max),
    )
    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    return list
  }, [products, q, category, size, max, sort])

  const countIn = (c: string) => products?.filter((p) => p.category === c).length ?? 0

  return (
    <>
      <section className="page-band">
        <div className="page-band-inner">
          <p className="eyebrow varsity">The shop</p>
          <h1>{category || 'Shop everything'}</h1>
          <p>Officially licensed Yale apparel, every style in sizes XS–XXL.</p>
        </div>
      </section>

      <section className="section shop">
        <div className="category-chips" role="group" aria-label="Category">
          <button className={!category ? 'chip active' : 'chip'} onClick={() => setParam('category', '')}>
            All{products ? <span className="chip-count">{products.length}</span> : null}
          </button>
          {SHOP_CATEGORIES.map((c) => (
            <button
              key={c}
              className={category === c ? 'chip active' : 'chip'}
              aria-pressed={category === c}
              onClick={() => setParam('category', category === c ? '' : c)}
            >
              {c}
              {products ? <span className="chip-count">{countIn(c)}</span> : null}
            </button>
          ))}
        </div>

        <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
          <label className="filter-search">
            <SearchIcon size={18} />
            <span className="sr-only">Search products</span>
            <input
              type="search"
              placeholder="Search by name, color, college, sport…"
              value={q}
              onChange={(e) => setParam('q', e.target.value)}
            />
          </label>
          <label className="filter-select">
            <span className="filter-label">Size</span>
            <select value={size} onChange={(e) => setParam('size', e.target.value)}>
              <option value="">Any size</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} in stock
                </option>
              ))}
            </select>
          </label>
          <label className="filter-select">
            <span className="filter-label">Price</span>
            <select value={max ? String(max) : ''} onChange={(e) => setParam('max', e.target.value)}>
              <option value="">Any price</option>
              {PRICE_LIMITS.map((p) => (
                <option key={p} value={p}>
                  Under ${p}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-select">
            <span className="filter-label">Sort</span>
            <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'name' ? '' : e.target.value)}>
              {Object.entries(SORTS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </form>

        {products && (
          <div className="results-bar">
            <p className="result-count" aria-live="polite">
              {filtered.length === products.length
                ? `${products.length} products`
                : `Showing ${filtered.length} of ${products.length} products`}
            </p>
            {hasFilters && (
              <button type="button" className="btn-link" onClick={clearFilters}>
                <CloseIcon size={14} /> Clear filters
              </button>
            )}
          </div>
        )}

        {!products && !error && (
          <div className="product-grid" aria-busy="true" aria-label="Loading products">
            {Array.from({ length: 8 }, (_, i) => (
              <ProductTileSkeleton key={i} />
            ))}
          </div>
        )}

        {error && (
          <div className="state-box error" role="alert">
            <h3>We couldn't load products</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </div>
        )}

        {products &&
          (filtered.length === 0 ? (
            <div className="state-box">
              <h3>
                No products match
                {q ? ` "${q}"` : ''}
                {q && (category || size || max) ? ' with these filters' : q ? '' : ' these filters'}
              </h3>
              <p>Try a different search word, choose another category or size, or clear the filters.</p>
              <div className="state-actions">
                <button className="btn btn-primary" onClick={clearFilters}>
                  Clear filters
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => openChat(q ? `Do you have anything like "${q}"?` : 'Can you help me find something?')}
                >
                  <ChatIcon size={18} /> Ask our assistant
                </button>
              </div>
            </div>
          ) : (
            <div className="product-grid">
              {filtered.map((p, i) => (
                <ProductTile key={p.product_id} product={p} index={i} />
              ))}
            </div>
          ))}
      </section>
    </>
  )
}
