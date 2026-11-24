import type { ApiRequest } from './api.interface'

export class ApiError extends Error {
  readonly reason: string

  constructor(reason: string) {
    super(reason)
    this.reason = reason
  }
}

export const ApiResources = {
  async request({ method, path, signal, body }: ApiRequest): Promise<unknown> {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    const origin = local
      ? 'http://127.0.0.1:8080'
      : 'https://renewal-api-809086370856.us-central1.run.app'
    const response = await fetch(new URL(path, process.env.NEXT_PUBLIC_API_ORIGIN || origin), {
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      method, signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new ApiError(typeof error?.reason === 'string' ? error.reason : 'storage')
    }
    if (response.status === 204) return
    return response.json()
  },
}
