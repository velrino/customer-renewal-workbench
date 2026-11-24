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
  await assert.rejects(API.health.read(signal), /Invalid health response/)

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

test('HTTP errors preserve public reasons and valid retry delays', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hostname: 'localhost' } } })
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window') })
  for (const [status, body, delay, reason] of [
    [429, '{"reason":"rateLimited"}', '7', 'rateLimited'],
    [503, '{"status":"degraded","checks":{"firestore":{"status":"down"}}}', '', 'storage'],
    [503, 'Unavailable', '', 'storage'],
  ] as const) {
    t.mock.method(globalThis, 'fetch', async () => new Response(body, { status, headers: { 'Retry-After': delay } }))
    await assert.rejects(API.health.read(new AbortController().signal), { reason, retryAfterSeconds: delay ? 7 : undefined })
  }
})
