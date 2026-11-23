import { useCallback, useEffect, useState } from 'react'
import { createRecordStore } from '@/shared/storage/indexed-db'
import type { Account } from '../accounts'
import {
  applyCommand,
  WorkflowError,
  type AccountWork,
  type Changes,
  type Command,
} from '../workflow'

const databaseName = 'renewal-workbench-week-v1'
const records = createRecordStore<AccountWork>(databaseName, 'accounts')

type AccountCommand = { account: Account; revision: number; command: Command }

function saveCommand({ account, revision, command }: AccountCommand) {
  return records.update(current => applyCommand(current, account, revision, command))
}

export function useRenewalWork() {
  const [changes, setChanges] = useState<Changes>({})
  const [readError, setReadError] = useState(false)
  const [ready, setReady] = useState(false)
  const refresh = useCallback(async () => {
    try {
      setChanges(await records.readAll())
      setReadError(false)
      setReady(true)
    } catch {
      setReadError(true)
      setReady(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    const channel =
      typeof BroadcastChannel === 'function'
        ? new BroadcastChannel(databaseName)
        : null
    if (channel) channel.onmessage = refresh
    window.addEventListener('focus', refresh)
    return () => {
      channel?.close()
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])
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
  return { changes, save, saveTwo, ready, readError, refresh }
}

function publish() {
  if (typeof BroadcastChannel !== 'function') return
  const channel = new BroadcastChannel(databaseName)
  channel.postMessage('updated')
  channel.close()
}
