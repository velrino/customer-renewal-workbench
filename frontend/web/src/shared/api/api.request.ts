import type { ApiHealth } from './api.interface'
import { ApiResources } from './api.resources'

export const API = {
  health: {
    async read(signal: AbortSignal): Promise<ApiHealth> {
      const body = await ApiResources.request({ method: 'GET', path: '/', signal })
      if (body && typeof body === 'object' && 'status' in body &&
          (body.status === 'ok' || body.status === 'degraded')) {
        return { status: body.status }
      }
      throw new Error('Invalid health response')
    },
  },
}
