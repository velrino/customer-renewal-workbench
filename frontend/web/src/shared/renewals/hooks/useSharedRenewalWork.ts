import { useState, useEffect } from 'react'
import { API } from '@/shared/api/api.request'
import { useEnvironment } from '@/shared/api/environment'
import { ApiError } from '@/shared/api/api.resources'
import type { Account } from '../accounts'
import { failureReasons, WorkflowError, type Command, type Failure } from '../workflow'
import type { AccountCommand, RenewalWork } from './useRenewalWork'

function reason(error: unknown): Failure {
  if (error instanceof ApiError) {
    return failureReasons.find(reason => reason === error.reason) ?? 'storage'
  }
  return 'storage'
}

export function useSharedRenewalWork(): RenewalWork {
  const { board, availability } = useEnvironment()
  const ready = availability === 'available' && board.status === 'available'
  const readError = board.status === 'unavailable'

  const [acknowledged, setAcknowledged] = useState<Record<string, number>>({})
  function waitingFor(id: string) {
    return id in acknowledged && (board.changes[id]?.revision ?? 0) <= acknowledged[id]
  }
  const waiting = Object.keys(acknowledged).some(waitingFor)
  const { retryRead } = board
  useEffect(() => {
    if (!ready || !waiting) return
    const timer = window.setTimeout(retryRead, 5000)
    return () => window.clearTimeout(timer)
  }, [ready, waiting, retryRead])

  async function save(account: Account, revision: number, command: Command) {
    if (!ready || waitingFor(account.id)) throw new WorkflowError('storage')
    try {
      await API.workbench.save(account.id, revision, command)
      setAcknowledged(previous => ({ ...previous, [account.id]: Math.max(previous[account.id] ?? 0, revision) }))
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

  return { waitingFor, changes: board.changes, ready, readError, save, saveTwo, resetWork, retryRead: board.retryRead }
}
