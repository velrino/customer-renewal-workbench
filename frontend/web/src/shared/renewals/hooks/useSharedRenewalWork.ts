import { useEffect, useState } from 'react'
import { API } from '@/shared/api/api.request'
import { ApiError } from '@/shared/api/api.resources'
import type { Account } from '../accounts'
import { WorkflowError, type Changes, type Command, type Failure } from '../workflow'
import type { AccountCommand } from './useRenewalWork'

function reason(error: unknown): Failure {
  if (error instanceof ApiError) {
    switch (error.reason) {
      case 'ownerRequired': case 'invalidDate': case 'questionRequired': case 'full': case 'changed':
        return error.reason
    }
  }
  return 'storage'
}

export function useSharedRenewalWork() {
  const [changes, setChanges] = useState<Changes>({})
  const [ready, setReady] = useState(false)
  const [readError, setReadError] = useState(false)
  const [attempt, retry] = useState(0)
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    function failed() {
      if (!active) return
      setReadError(true)
      setReady(false)
    }
    import('../workflow/shared-board').then(({ subscribeBoard }) => {
      if (!active) return
      unsubscribe = subscribeBoard((snapshot, cached) => {
        if (!active) return
        setChanges(snapshot)
        setReady(!cached)
        setReadError(cached)
      }, failed)
    }).catch(failed)
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [attempt])

  async function save(account: Account, revision: number, command: Command) {
    if (!ready) throw new WorkflowError('storage')
    try {
      await API.workbench.save(account.id, revision, command)
    } catch (error) {
      throw new WorkflowError(reason(error))
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

  async function retryRead() {
    setReadError(false)
    retry(current => current + 1)
  }
  return { changes, ready, readError, save, saveTwo, resetWork, retryRead }
}
