import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="section narrow not-found">
      <p className="eyebrow varsity">Error 404</p>
      <h1>This page went off campus.</h1>
      <p>We couldn't find the page you were looking for.</p>
      <div className="state-actions">
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link to="/products" className="btn btn-outline">
          Browse the shop
        </Link>
      </div>
    </section>
  )
}
