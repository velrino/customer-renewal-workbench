import type { Command } from '@/shared/renewals/workflow'
import type { ApiHealth } from './api.interface'
import { ApiResources } from './api.resources.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const API = {
  workbench: {
    save(id: string, revision: number, command: Command) {
      return ApiResources.request({
        method: 'POST', path: `/workbench/accounts/${encodeURIComponent(id)}/commands`,
        signal: AbortSignal.timeout(10_000),
        body: { revision, command, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      })
    },
    reset(version: number) {
      return ApiResources.request({
        method: 'POST', path: '/workbench/reset', signal: AbortSignal.timeout(10_000), body: { version },
      })
    },
  },
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
