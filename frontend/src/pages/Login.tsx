import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import AuthLayout from '../components/AuthLayout'

export default function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const u = await login(email, password)
      setSuccess(`Welcome back, ${u.first_name || u.name}! You're logged in.`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPassword('')
      setSubmitting(false)
    }
  }

  if (user) {
    return (
      <AuthLayout title="Welcome back, Bulldog.">
        <div className="form-card">
          <h1>Log in</h1>
          <p className="form-message success">
            {success || `You're logged in as ${user.email}.`}
          </p>
          <Link to="/products" className="btn btn-primary">
            Start shopping
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Welcome back, Bulldog.">
      <form className="form-card" onSubmit={handleSubmit}>
        <h1>Log in</h1>
        <p className="form-sub">Welcome back to Campus Customs.</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="form-message error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="form-footer">
          New here? <Link to="/create-account">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
