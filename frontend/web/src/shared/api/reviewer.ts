// This profile is compiled only for the dedicated loopback dashboard.
export const reviewerEnabled = process.env.NEXT_PUBLIC_LOCAL_REVIEWER === '1'
export const reviewerAPI = 'http://127.0.0.1:8181'
let token = ''
let expiresAt = 0
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function sessionToken() {
  return Date.now() < expiresAt ? token : ''
}
export function clearSession() {
  clearTimeout(timer)
  token = ''
  expiresAt = 0
  for (const listener of listeners) listener()
}

export function assertReviewerOrigin() {
  if (!reviewerEnabled || window.location.origin !== 'http://127.0.0.1:3100') {
    throw new Error('Open the local reviewer dashboard at http://127.0.0.1:3100.')
  }
}

export async function signIn(email: string, password: string) {
  assertReviewerOrigin()
  const response = await fetch(reviewerAPI + '/reviewer/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }), credentials: 'omit', redirect: 'error',
    cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000),
  })
  if (response.status === 401) throw new Error('Check your email and password.')
  if (response.status === 429) throw new Error('Too many sign-in attempts or active sessions. Try again later.')
  if (!response.ok) throw new Error('Local authentication is unavailable. Check the reviewer services and try again.')
  const session = await response.json()
  if (typeof session.token !== 'string' || !session.token || !Number.isInteger(session.expiresIn) || session.expiresIn < 1 || session.expiresIn > 3600) {
    throw new Error('The local API returned an invalid session.')
  }
  clearTimeout(timer)
  token = session.token
  expiresAt = Date.now() + session.expiresIn * 1000
  timer = setTimeout(clearSession, session.expiresIn * 1000)
  for (const listener of listeners) listener()
}

export async function signOut() {
  assertReviewerOrigin()
  const previous = sessionToken()
  clearSession()
  if (!previous) return
  const response = await fetch(reviewerAPI + '/reviewer/logout', {
    method: 'POST', headers: { Authorization: 'Bearer ' + previous }, credentials: 'omit',
    cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000),
  })
  if (!response.ok && response.status !== 401) throw new Error('Session revocation failed.')
}
