import type { Command } from '@/shared/renewals/workflow'
import type { ApiHealth } from './api.interface'
import { ApiResources } from './api.resources'

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
      if (body && typeof body === 'object' && 'status' in body &&
          (body.status === 'ok' || body.status === 'degraded')) {
        return { status: body.status }
      }
      throw new Error('Invalid health response')
    },
  },
}
