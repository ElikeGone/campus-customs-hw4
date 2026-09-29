import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, formatPrice, NotFoundError, type ProductDetail as Detail } from '../api'
import { categoryLink } from '../catalog'
import { openChat } from '../chatEvents'
import { ArrowLeftIcon, ChatIcon, ShieldIcon } from '../components/Icons'

// Approximate swatch colors for the color names used in the catalogue.
const SWATCHES: [string, string][] = [
  ['charcoal', '#3d4148'],
  ['heather gray', '#b9bcc2'],
  ['gray', '#a7abb2'],
  ['grey', '#a7abb2'],
  ['navy', '#1d2b53'],
  ['royal', '#2a4fa8'],
  ['blue', '#286dc0'],
  ['white', '#ffffff'],
  ['black', '#16181c'],
  ['red', '#b3342a'],
  ['maroon', '#6b2231'],
  ['green', '#2f6b45'],
  ['cream', '#efe6d2'],
  ['ivory', '#f4eedd'],
  ['oatmeal', '#ddd2bd'],
  ['gold', '#c9a23a'],
  ['yellow', '#e3c13b'],
  ['pink', '#e7a3b8'],
  ['brown', '#6d4c34'],
]
const swatchFor = (color: string) => SWATCHES.find(([name]) => color.toLowerCase().includes(name))?.[1] ?? '#cfd4db'

export default function ProductDetail() {
  const { productId = '' } = useParams()
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  // Results are keyed by id and attempt, so a stale result isn't shown after navigating to another
  // product, and "Try again" shows the loading state again.
  const key = `${productId}#${attempt}`
  const [result, setResult] = useState<{ key: string; product?: Detail; error?: string; notFound?: boolean } | null>(null)

  useEffect(() => {
    fetchProduct(productId)
      .then((product) => setResult({ key, product }))
      .catch((e: Error) => setResult({ key, error: e.message, notFound: e instanceof NotFoundError }))
  }, [productId, key])

  const current = result?.key === key ? result : null
  const product = current?.product
  const error = current?.error
  const chosen = product?.inventory.find((s) => s.size === selected)

  return (
    <section className="section detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/products" className="back-link">
          <ArrowLeftIcon size={16} /> Back to Products
        </Link>
        {product && (
          <span className="crumbs">
            <Link to="/products">Shop</Link>
            <span aria-hidden="true">/</span>
            <Link to={categoryLink(product.category)}>{product.category}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{product.name}</span>
          </span>
        )}
      </nav>

      {!product && !error && (
        <div className="detail" aria-busy="true" aria-label="Loading product">
          <div className="detail-image skeleton-block tall" />
          <div className="detail-info">
            <div className="skeleton-line short" />
            <div className="skeleton-line wide tall" />
            <div className="skeleton-line short" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </div>
      )}

      {current?.notFound && (
        <div className="state-box">
          <h3>We couldn't find that product</h3>
          <p>It may have been removed, or the link might be wrong.</p>
          <Link to="/products" className="btn btn-primary">
            Browse all products
          </Link>
        </div>
      )}

      {error && !current?.notFound && (
        <div className="state-box error" role="alert">
          <h3>We couldn't load this product</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      )}

      {product && (
        <div className="detail">
          <div className="detail-image">
            <img src={product.image_url} alt={product.name} />
            {product.total_stock === 0 && <span className="badge badge-soldout">Sold out</span>}
          </div>

          <div className="detail-info">
            <p className="eyebrow varsity">{product.garment_type}</p>
            <h1>{product.name}</h1>
            <p className="detail-price">{formatPrice(product.price)}</p>
            <p className="detail-desc">{product.description}</p>

            <div className="detail-colors">
              <span className="detail-label">Colors</span>
              <ul className="swatches">
                {product.colors.map((c) => (
                  <li key={c}>
                    <span className="swatch" style={{ background: swatchFor(c) }} aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="detail-sizes">
              <div className="detail-sizes-head">
                <h3>Sizes &amp; availability</h3>
                <span className="stock-total">
                  {product.total_stock > 0 ? `${product.total_stock} in stock across all sizes` : 'Currently sold out'}
                </span>
              </div>
              <ul className="sizes">
                {product.inventory.map((s) => (
                  <li key={s.size}>
                    <button
                      type="button"
                      className={[
                        'size',
                        s.quantity === 0 ? 'out' : '',
                        selected === s.size ? 'selected' : '',
                      ].join(' ')}
                      aria-pressed={selected === s.size}
                      onClick={() => setSelected(selected === s.size ? null : s.size)}
                    >
                      <span className="size-label">{s.size}</span>
                      <span className="size-qty">{s.quantity === 0 ? 'Sold out' : `${s.quantity} left`}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="size-note" aria-live="polite">
                {chosen
                  ? chosen.quantity > 0
                    ? `Size ${chosen.size}: ${chosen.quantity} in stock at the shop.`
                    : `Size ${chosen.size} is sold out right now.`
                  : 'Select a size to check its stock.'}
              </p>
            </div>

            <div className="detail-actions">
              <button
                className="btn btn-primary"
                onClick={() =>
                  openChat(
                    chosen
                      ? chosen.quantity > 0
                        ? `Tell me more about this in size ${chosen.size}.`
                        : `Size ${chosen.size} is sold out. What similar items do you have in ${chosen.size}?`
                      : 'Can you tell me more about this?',
                  )
                }
              >
                <ChatIcon size={18} /> Ask about this item
              </button>
              <Link to={categoryLink(product.category)} className="btn btn-outline">
                More {product.category.toLowerCase()}
              </Link>
            </div>

            <p className="detail-assurance">
              <ShieldIcon size={18} /> Officially licensed Yale apparel from Campus Customs, 57 Broadway, New Haven.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
