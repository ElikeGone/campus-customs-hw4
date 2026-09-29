import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// The backend never sends passwords or hashes; this is everything the frontend knows about a user.
export interface User {
  id: number
  first_name: string | null
  last_name: string | null
  name: string
  email: string
}

export interface RegisterData {
  first_name: string
  last_name: string
  email: string
  password: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (data: RegisterData) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'Something went wrong. Please try again.')
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from the HttpOnly cookie on page load.
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const u = await postJson<User>('/api/auth/login', { email, password })
    setUser(u)
    return u
  }

  const register = async (data: RegisterData) => {
    const u = await postJson<User>('/api/auth/register', data)
    setUser(u)
    return u
  }

  const logout = async () => {
    await postJson<void>('/api/auth/logout')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
