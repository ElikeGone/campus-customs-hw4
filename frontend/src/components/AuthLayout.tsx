import type { ReactNode } from 'react'
import { CheckIcon } from './Icons'
import { Crest } from './Logo'

// Two-panel layout for the Log in and Create account pages.
export default function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section auth">
      <div className="auth-shell">
        <aside className="auth-panel" aria-hidden="true">
          <Crest size={56} />
          <h2>{title}</h2>
          <ul>
            <li>
              <CheckIcon size={18} /> Pick up your chat with our assistant where you left off
            </li>
            <li>
              <CheckIcon size={18} /> Get greeted by name when you come back
            </li>
            <li>
              <CheckIcon size={18} /> Real-time sizes and stock on every style
            </li>
          </ul>
          <span className="auth-panel-foot">Campus Customs · 57 Broadway</span>
        </aside>
        <div className="auth-form-wrap">{children}</div>
      </div>
    </section>
  )
}
