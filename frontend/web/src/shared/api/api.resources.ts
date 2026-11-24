import type { ApiRequest } from './api.interface'
import { assertReviewerOrigin, clearSession, reviewerAPI, reviewerEnabled, sessionToken } from './reviewer.ts'

export class ApiError extends Error {
  readonly reason: string

  readonly retryAfterSeconds?: number

  constructor(reason: string, retryAfterSeconds?: number) {
    super(reason)
    this.reason = reason
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const ApiResources = {
  async request({ method, path, signal, body }: ApiRequest): Promise<unknown> {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    const origin = local
      ? 'http://127.0.0.1:8080'
      : 'https://renewal-api-809086370856.us-central1.run.app'
    const url = new URL(path, reviewerEnabled ? reviewerAPI : process.env.NEXT_PUBLIC_API_ORIGIN || origin)
    const headers = new Headers(body === undefined ? undefined : { 'Content-Type': 'application/json' })
    const session = reviewerEnabled && path !== '/' ? sessionToken() : ''
    if (reviewerEnabled) {
      assertReviewerOrigin()
      if (url.origin !== reviewerAPI) throw new ApiError('invalidOrigin')
      if (path !== '/' && !session) throw new ApiError('signInRequired')
      if (session) headers.set('Authorization', 'Bearer ' + session)
    }
    const response = await fetch(url, {
      headers, redirect: reviewerEnabled ? 'error' : 'follow',
      body: body === undefined ? undefined : JSON.stringify(body),
      method, signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    })
    if (!response.ok) {
      if (session && response.status === 401 && session === sessionToken()) clearSession()
      const error = await response.json().catch(() => null)
      const delay = Number(response.headers.get('Retry-After'))
      const retryAfterSeconds = response.status === 429 && Number.isSafeInteger(delay) && delay > 0 ? delay : undefined
      throw new ApiError(typeof error?.reason === 'string' ? error.reason : 'storage', retryAfterSeconds)
    }
    if (response.status === 204) return
    return response.json()
  },
}
