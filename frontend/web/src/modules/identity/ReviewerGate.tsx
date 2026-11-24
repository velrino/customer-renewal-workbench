'use client'

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, BriefcaseBusiness, Eye, EyeOff } from 'lucide-react'
import { reviewerEnabled, sessionToken, signIn, subscribeSession } from '@/shared/api/reviewer'
import styles from './reviewer.module.css'

export function ReviewerGate({ children }: { children: ReactNode }) {
  return reviewerEnabled ? <LocalGate>{children}</LocalGate> : children
}

function LocalGate({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, sessionToken, () => '')
  return session ? children : <Login />
}

function Login() {
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setError('')
    setPending(true)
    try {
      await signIn(String(data.get('email')), String(data.get('password')))
    } catch (failure) {
      setError(failure instanceof TypeError || !(failure instanceof Error) || failure.name === 'TimeoutError'
        ? 'Could not reach the local API. Check the reviewer services and try again.' : failure.message)
    } finally {
      setPending(false)
    }
  }

  return <main className={styles.page}>
    <section className={styles.story} aria-labelledby="reviewer-heading">
      <div className={styles.brand}><BriefcaseBusiness size={20} aria-hidden="true" />Customer Renewal Workbench</div>
      <div className={styles.message}>
        <h1 id="reviewer-heading">Plan the next<br /> renewal.</h1>
        <p>Review account signals, choose where to spend your two intervention slots, and record the evidence behind each decision.</p>
      </div>
      <div className={styles.scope}><span aria-hidden="true" />Local reviewer workspace</div>
    </section>
    <section className={styles.panel} aria-labelledby="login-heading">
      <form className={styles.form} onSubmit={submit}>
        <h2 id="login-heading">Reviewer sign-in</h2>
        <p>Use the reviewer account created for this workstation.</p>
        <label htmlFor="reviewer-email">Email address</label>
        <input id="reviewer-email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="reviewer-password">Password</label>
        <div className={styles.password}>
          <input id="reviewer-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required />
          <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        <button className={styles.submit} disabled={pending}>{pending ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} aria-hidden="true" /></button>
      </form>
    </section>
  </main>
}
