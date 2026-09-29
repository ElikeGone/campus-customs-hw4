import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import AuthLayout from '../components/AuthLayout'

const MIN_PASSWORD_LENGTH = 8

export default function CreateAccount() {
  const { user, register } = useAuth()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const u = await register({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
      })
      setSuccess(`Account created! Welcome to Campus Customs, ${u.first_name || u.name}. You're now logged in.`)
      setForm({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (user) {
    return (
      <AuthLayout title="Join the Campus Customs community.">
        <div className="form-card">
          <h1>Create account</h1>
          <p className="form-message success">
            {success || `You're already logged in as ${user.email}.`}
          </p>
          <Link to="/products" className="btn btn-primary">
            Start shopping
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Join the Campus Customs community.">
      <form className="form-card" onSubmit={handleSubmit}>
        <h1>Create account</h1>
        <p className="form-sub">Join Campus Customs to shop and chat with our assistant.</p>

        <div className="form-row">
          <label>
            First name
            <input value={form.firstName} onChange={update('firstName')} autoComplete="given-name" required />
          </label>
          <label>
            Last name
            <input value={form.lastName} onChange={update('lastName')} autoComplete="family-name" required />
          </label>
        </div>
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            required
          />
          <span className="hint">At least {MIN_PASSWORD_LENGTH} characters.</span>
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={form.confirm}
            onChange={update('confirm')}
            autoComplete="new-password"
            required
          />
        </label>

        {error && <p className="form-message error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="form-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
