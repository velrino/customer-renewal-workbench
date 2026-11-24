import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRecordStore } from '@/shared/storage/indexed-db'
import type { Account } from '../accounts'
import {
  applyCommand,
  WorkflowError,
  type AccountWork,
  type Changes,
  type Plan,
  type Command,
} from '../workflow'

const databaseName = 'renewal-workbench-week-v1'
const records = createRecordStore<AccountWork>(databaseName, 'accounts')

export type AccountCommand = { account: Account; revision: number; command: Command }

// A practice run uses the same commands as Local, with records scoped to this mount.
function createPracticeStore(): Pick<typeof records, 'readAll' | 'update'> {
  let changes: Changes = {}
  return {
    async readAll() { return changes },
    async update(derive) {
      const record = derive(changes)
      changes = { ...changes, [record.id]: record }
      return changes
    },
  }
}

export async function keepDemoPlan(account: Account, plan: Plan) {
  // Validate both commands against the current board in one IndexedDB transaction.
  await records.update(current => {
    if (current[account.id]?.plan) throw new WorkflowError('changed')
    const active = applyCommand(current, account, current[account.id]?.revision ?? 0, {
      type: 'plan', action: plan.action, owner: plan.owner, followUp: plan.followUp,
    })
    return applyCommand({ ...current, [account.id]: active }, account, active.revision, { type: 'complete' })
  })
  notifyLocalTabs()
}

function notifyLocalTabs() {
  if (typeof BroadcastChannel !== 'function') return
  try {
    const channel = new BroadcastChannel(databaseName)
    try {
      channel.postMessage('updated')
    } finally {
      channel.close()
    }
  } catch {
    // The change is committed. Restricted tabs refresh when they regain focus.
  }
}

export function useRenewalWork(practice = false) {
  const store = useMemo(() => practice ? createPracticeStore() : records, [practice])
  function saveCommand({ account, revision, command }: AccountCommand) {
    return store.update(current => applyCommand(current, account, revision, command))
  }
  const channel = useRef<BroadcastChannel | null>(null)
  const [changes, setChanges] = useState<Changes>({})
  const [readError, setReadError] = useState(false)
  const [ready, setReady] = useState(false)
  const refresh = useCallback(async () => {
    try {
      setChanges(await store.readAll())
      setReadError(false)
      setReady(true)
    } catch {
      setReadError(true)
      setReady(false)
    }
  }, [store])
  useEffect(() => {
    void refresh()
    if (practice) return
    try {
      if (typeof BroadcastChannel === 'function') {
        channel.current = new BroadcastChannel(databaseName)
        channel.current.onmessage = refresh
      }
    } catch {
      // Focus refresh also works when the browser restricts messaging.
    }
    window.addEventListener('focus', refresh)
    return () => {
      channel.current?.close()
      channel.current = null
      window.removeEventListener('focus', refresh)
    }
  }, [refresh, practice])
  function publish() {
    try {
      channel.current?.postMessage('updated')
    } catch {
      // The write has committed. Other tabs can still refresh on focus.
    }
  }
  async function save(account: Account, revision: number, command: Command) {
    try {
      setChanges(await saveCommand({ account, revision, command }))
    } catch (error) {
      await refresh()
      throw error
    }
    publish()
  }
  async function saveTwo(
    commands: AccountCommand[],
  ) {
    const settled = await Promise.allSettled(
      commands.map(saveCommand),
    )
    publish()
    await refresh()
    return settled.map((result, index) => ({
      id: commands[index].account.id,
      ok: result.status === 'fulfilled',
      reason:
        result.status === 'rejected'
          ? result.reason instanceof WorkflowError
            ? result.reason.reason
            : 'storage'
          : undefined,
    }))
  }
  async function resetWork() {
    // An explicit Local reset also targets the saved portfolio when invoked from a practice run.
    await records.clear()
    if (!practice) setChanges({})
    notifyLocalTabs()
  }
  async function retryRead() {
    setReadError(false)
    await refresh()
  }
  return { changes, resetWork, save, saveTwo, ready, readError, retryRead }
}
