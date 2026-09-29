import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts, type ProductListItem } from '../api'
import { CATEGORY_IMAGES, categoryLink, SHOP_CATEGORIES } from '../catalog'
import { openChat } from '../chatEvents'
import { ArrowRightIcon, ChatIcon, PinIcon, ShieldIcon, SparkIcon } from '../components/Icons'
import ProductTile, { ProductTileSkeleton } from '../components/ProductTile'

const FEATURED_IDS = [
  'district-vit-hoodie-vintage-bulldog',
  '2025-yale-vs-harvard-t-shirt',
  'davenport-college-crewneck',
  'brooks-brothers-bomber-jacket-yale',
]

const MARQUEE = ['Hoodies', 'Crewnecks', 'T-shirts', 'Quarter-zips', 'Jackets & fleece', 'Game day', 'Move-in', 'Reunions', 'Family weekend']

const HERO_CARDS = [
  { id: 'district-vit-hoodie-vintage-bulldog', label: 'Vintage Bulldog Hoodie' },
  { id: '2025-yale-vs-harvard-t-shirt', label: 'The Game 2025 Tee' },
  { id: 'davenport-college-crewneck', label: 'Davenport Crewneck' },
]

export default function Home() {
  const [products, setProducts] = useState<ProductListItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setFailed(true))
  }, [])

  const featured = products ? FEATURED_IDS.map((id) => products.find((p) => p.product_id === id)).filter((p) => !!p) : []
  const countFor = (c: string) => products?.filter((p) => p.category === c).length

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow varsity">On Broadway · New Haven</p>
            <h1>
              Blue, bold, and <em>Bulldog</em> through and through.
            </h1>
            <p className="hero-lead">
              Officially licensed Yale apparel for game days, move-in days, reunions, and every ordinary Tuesday in
              between, from the shop a short walk from Old Campus.
            </p>
            <div className="hero-actions">
              <Link to="/products" className="btn btn-primary">
                Shop the collection <ArrowRightIcon size={18} />
              </Link>
              <button className="btn btn-outline" onClick={() => openChat('Can you help me find a gift?')}>
                <ChatIcon size={18} /> Ask our assistant
              </button>
            </div>
            <dl className="hero-facts">
              <div>
                <dt>{products ? products.length : '100+'}</dt>
                <dd>styles in the shop</dd>
              </div>
              <div>
                <dt>XS–XXL</dt>
                <dd>in every style</dd>
              </div>
              <div>
                <dt>57</dt>
                <dd>Broadway, New Haven</dd>
              </div>
            </dl>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="pennant">
              <span>Boola Boola</span>
            </div>
            {HERO_CARDS.map((c, i) => (
              <figure key={c.id} className={`polaroid p${i + 1}`}>
                <img src={`/media/products/${c.id}.jpg`} alt="" />
                <figcaption>{c.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i}>
              {m} <b>✦</b>
            </span>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow varsity">Shop by style</p>
            <h2>Find your fit</h2>
          </div>
          <Link to="/products" className="text-link">
            View everything <ArrowRightIcon size={16} />
          </Link>
        </div>
        <div className="category-grid">
          {SHOP_CATEGORIES.map((c) => (
            <Link key={c} to={categoryLink(c)} className="category-tile">
              <div className="category-image">
                <img src={CATEGORY_IMAGES[c]} alt="" loading="lazy" />
              </div>
              <div className="category-label">
                <span className="category-name">{c}</span>
                {countFor(c) ? <span className="category-count">{countFor(c)} styles</span> : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {!failed && (
        <section className="section featured">
          <div className="section-head">
            <div>
              <p className="eyebrow varsity">Featured</p>
              <h2>A few favorites from the racks</h2>
            </div>
          </div>
          <div className="product-grid">
            {products
              ? featured.map((p, i) => <ProductTile key={p.product_id} product={p} index={i} />)
              : Array.from({ length: 4 }, (_, i) => <ProductTileSkeleton key={i} />)}
          </div>
        </section>
      )}

      <section className="section">
        <div className="assistant-promo">
          <div className="assistant-promo-copy">
            <p className="eyebrow varsity light">Shopping help</p>
            <h2>Not sure what to get?</h2>
            <p>
              Our assistant searches the real catalogue, checks sizes and stock, and shows you the matches. Log in and
              it'll remember your conversation next time.
            </p>
            <div className="promo-prompts">
              {['Show me hoodies under $70', 'Gift ideas for a Yale dad', 'Is the Davenport Crewneck in XL?'].map((q) => (
                <button key={q} className="prompt-chip light" onClick={() => openChat(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div className="assistant-promo-art" aria-hidden="true">
            <div className="bubble b1">Do you have this in medium?</div>
            <div className="bubble b2">Yes! We have 15 in size M.</div>
          </div>
        </div>
      </section>

      <section className="section values">
        <div className="value">
          <ShieldIcon size={28} />
          <h3>Officially licensed</h3>
          <p>Authentic Yale crests, wordmarks, and college marks.</p>
        </div>
        <div className="value">
          <SparkIcon size={28} />
          <h3>For every Bulldog</h3>
          <p>Students, alumni, parents, faculty, and fans, from XS to XXL.</p>
        </div>
        <div className="value">
          <PinIcon size={28} />
          <h3>Right on Broadway</h3>
          <p>Shop online or stop by the store at 57 Broadway in New Haven.</p>
        </div>
      </section>
    </>
  )
}
