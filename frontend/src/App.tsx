import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import Footer from './components/Footer'
import ChatWidget from './components/ChatWidget'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import About from './pages/About'
import Login from './pages/Login'
import CreateAccount from './pages/CreateAccount'
import NotFound from './pages/NotFound'

export default function App() {
  const { pathname } = useLocation()

  // Start each new page at the top (filter changes on the same page keep their scroll position).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <NavBar />
      {/* Keyed by path so each page fades in. */}
      <main id="main" className="main page-enter" key={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  )
}
