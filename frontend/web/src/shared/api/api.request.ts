import type { ApiHealth } from './api.interface'
import { ApiResources } from './api.resources.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const API = {
  health: {
    async read(signal: AbortSignal): Promise<ApiHealth> {
      const body = await ApiResources.request({ method: 'GET', path: '/', signal })
      if (isRecord(body) && isRecord(body.checks) && isRecord(body.checks.firestore)) {
        const firestore = body.checks.firestore.status
        if (body.status === 'ok' && firestore === 'up') return { status: 'ok' }
        if (body.status === 'degraded' && firestore === 'down') return { status: 'degraded' }
      }
      throw new Error('Invalid health response')
    },
  },
}
