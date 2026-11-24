import assert from 'node:assert/strict'
import test from 'node:test'
import { API } from './api.request.ts'
import { ApiResources } from './api.resources.ts'

test('health requires the overall status and Firestore check to agree', async t => {
  const signal = new AbortController().signal
  let body: unknown
  t.mock.method(ApiResources, 'request', async () => body)

  body = { status: 'ok', checks: { firestore: { status: 'up', response_time: 12 } } }
  assert.deepEqual(await API.health.read(signal), { status: 'ok' })

  body = { status: 'degraded', checks: { firestore: { status: 'down' } } }
  assert.deepEqual(await API.health.read(signal), { status: 'degraded' })

  const invalidResponses = [
    null,
    { status: 'ok' },
    { status: 'ok', checks: {} },
    { status: 'ok', checks: { firestore: { status: 'down' } } },
    { status: 'degraded', checks: { firestore: { status: 'up' } } },
  ]
  for (const invalid of invalidResponses) {
    body = invalid
    await assert.rejects(API.health.read(signal), /Invalid health response/)
  }
})
