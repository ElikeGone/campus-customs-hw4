import { Link } from 'react-router-dom'
import { formatPrice, type ProductListItem } from '../api'

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

// Product card used on the Shop page and the Home page.
export default function ProductTile({ product: p, index = 0 }: { product: ProductListItem; index?: number }) {
  const soldOut = p.sizes_in_stock.length === 0
  return (
    <Link
      to={`/products/${p.product_id}`}
      className="product-card"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="product-image">
        <img src={p.image_url} alt={p.name} loading="lazy" />
        {soldOut && <span className="badge badge-soldout">Sold out</span>}
      </div>
      <div className="product-info">
        <span className="product-eyebrow">{p.category}</span>
        <h3>{p.name}</h3>
        <p className="product-desc">{p.description}</p>
        <div className="product-meta">
          <span className="price">{formatPrice(p.price)}</span>
          <span className="size-dots" aria-label={`In stock: ${p.sizes_in_stock.join(', ') || 'none'}`}>
            {ALL_SIZES.map((s) => (
              <span key={s} className={p.sizes_in_stock.includes(s) ? 'dot on' : 'dot'}>
                {s}
              </span>
            ))}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function ProductTileSkeleton() {
  return (
    <div className="product-card skeleton" aria-hidden="true">
      <div className="product-image skeleton-block" />
      <div className="product-info">
        <div className="skeleton-line short" />
        <div className="skeleton-line wide" />
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    </div>
  )
}
