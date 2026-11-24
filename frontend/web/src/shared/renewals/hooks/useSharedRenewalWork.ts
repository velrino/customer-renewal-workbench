import { API } from '@/shared/api/api.request'
import { useEnvironment } from '@/shared/api/environment'
import { ApiError } from '@/shared/api/api.resources'
import type { Account } from '../accounts'
import { WorkflowError, type Command, type Failure } from '../workflow'
import type { AccountCommand } from './useRenewalWork'

function reason(error: unknown): Failure {
  if (error instanceof ApiError) {
    switch (error.reason) {
      case 'ownerRequired': case 'invalidDate': case 'questionRequired': case 'full': case 'changed': case 'rateLimited':
        return error.reason
    }
  }
  return 'storage'
}

export function useSharedRenewalWork() {
  const { board, availability } = useEnvironment()
  const ready = availability === 'available' && board.status === 'available'
  const readError = board.status === 'unavailable'

  async function save(account: Account, revision: number, command: Command) {
    if (!ready) throw new WorkflowError('storage')
    try {
      await API.workbench.save(account.id, revision, command)
    } catch (error) {
      throw new WorkflowError(reason(error), error instanceof ApiError ? error.retryAfterSeconds : undefined)
    }
  }

  async function saveTwo(commands: AccountCommand[]) {
    return Promise.all(commands.map(async ({ account, revision, command }) => {
      try {
        await save(account, revision, command)
        return { id: account.id, ok: true, reason: undefined }
      } catch (error) {
        return { id: account.id, ok: false, reason: error instanceof WorkflowError ? error.reason : 'storage' as const }
      }
    }))
  }

  async function resetWork() {
    if (!ready) throw new WorkflowError('storage')
    await API.workbench.reset()
  }

  return { changes: board.changes, ready, readError, save, saveTwo, resetWork, retryRead: board.retryRead }
}
