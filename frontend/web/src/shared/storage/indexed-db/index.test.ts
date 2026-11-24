import assert from 'node:assert/strict'
import test from 'node:test'
import 'fake-indexeddb/auto'
import {createRecordStore} from './index.ts'
import {accounts} from '../../renewals/accounts/index.ts'
import {applyCommand, committed, today, type AccountWork} from '../../renewals/workflow/index.ts'

test('independent IndexedDB connections compete for the last slot', async () => {
  const connect = () => createRecordStore<AccountWork>('capacity-test', 'accounts')
  const first = connect()
  const second = connect()
  const save = (store: typeof first, id: string) => store.update(changes =>
    applyCommand(changes, accounts.find(a => a.id === id)!, 0, {type:'plan', action:'budget', owner:'Demo', followUp:today()}))
  await save(first, 'ember')
  const results = await Promise.allSettled([save(first, 'beacon'), save(second, 'cove')])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected')?.reason.reason, 'full')
  assert.equal(committed(await connect().readAll()).length, 2)
})
