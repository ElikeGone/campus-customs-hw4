import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { openChat } from '../chatEvents'
import { ChatIcon, CloseIcon, MenuIcon } from './Icons'
import Logo from './Logo'
import { categoryLink, SHOP_CATEGORIES } from '../catalog'

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Close the mobile menu whenever the page changes.
  const [lastPath, setLastPath] = useState(location.pathname + location.search)
  const currentPath = location.pathname + location.search
  if (currentPath !== lastPath) {
    setLastPath(currentPath)
    setOpen(false)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link')

  return (
    <header className={scrolled ? 'site-header scrolled' : 'site-header'}>
      <div className="announce">
        <span>Officially licensed Yale apparel</span>
        <span className="announce-sep" aria-hidden="true">
          ✦
        </span>
        <span>Visit us at 57 Broadway, New Haven</span>
      </div>

      <div className="navbar">
        <Link to="/" className="brand" aria-label="Campus Customs home">
          <Logo />
        </Link>

        <nav id="site-nav" className={open ? 'nav open' : 'nav'} aria-label="Main">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <div className="nav-dropdown">
            <NavLink to="/products" className={linkClass}>
              Shop
            </NavLink>
            <div className="dropdown-panel">
              <span className="dropdown-title">Shop by style</span>
              {SHOP_CATEGORIES.map((c) => (
                <Link key={c} to={categoryLink(c)} className="dropdown-link">
                  {c}
                </Link>
              ))}
              <Link to="/products" className="dropdown-link all">
                Everything →
              </Link>
            </div>
          </div>
          <NavLink to="/about" className={linkClass}>
            About Us
          </NavLink>

          <span className="nav-divider" aria-hidden="true" />

          {user ? (
            <>
              <span className="nav-user">
                <span className="nav-avatar" aria-hidden="true">
                  {(user.first_name || user.name).charAt(0)}
                </span>
                Hi, {user.first_name || user.name}
              </span>
              <button className="nav-cta ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                Log in
              </NavLink>
              <NavLink
                to="/create-account"
                className={({ isActive }) => (isActive ? 'nav-cta active' : 'nav-cta')}
              >
                Create account
              </NavLink>
            </>
          )}
          <button className="nav-chat" onClick={() => openChat()}>
            <ChatIcon size={18} /> Ask us
          </button>
        </nav>

        <button
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>
    </header>
  )
}
