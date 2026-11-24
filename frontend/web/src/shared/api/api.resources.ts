import type { ApiRequest } from './api.interface'

export const ApiResources = {
  async request({ method, path, signal }: ApiRequest): Promise<unknown> {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    const origin = local
      ? 'http://127.0.0.1:8080'
      : 'https://renewal-api-809086370856.us-central1.run.app'
    const response = await fetch(new URL(path, origin), {
      method, signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    })
    if (!response.ok) throw new Error(`Health request failed (HTTP ${response.status})`)
    return response.json()
  },
}
