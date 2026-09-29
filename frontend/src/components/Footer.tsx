import { Link } from 'react-router-dom'
import { openChat } from '../chatEvents'
import { Crest } from './Logo'
import { categoryLink, SHOP_CATEGORIES } from '../catalog'

const YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-pennants" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className="footer-inner">
        <div className="footer-brand">
          <Crest size={48} />
          <p className="footer-name">Campus Customs</p>
          <p className="footer-tag">Yale apparel for students, alumni, families, and fans, sold a short walk from Old Campus.</p>
        </div>
        <div className="footer-col">
          <h4>Shop</h4>
          {SHOP_CATEGORIES.map((c) => (
            <Link key={c} to={categoryLink(c)}>
              {c}
            </Link>
          ))}
        </div>
        <div className="footer-col">
          <h4>Help</h4>
          <button className="footer-link-button" onClick={() => openChat()}>
            Chat with our assistant
          </button>
          <Link to="/login">Log in</Link>
          <Link to="/create-account">Create an account</Link>
          <Link to="/about">About us</Link>
        </div>
        <div className="footer-col">
          <h4>Visit</h4>
          <p>
            57 Broadway
            <br />
            New Haven, CT
          </p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {YEAR} Campus Customs</span>
        <span>Officially licensed Yale apparel</span>
      </div>
    </footer>
  )
}
