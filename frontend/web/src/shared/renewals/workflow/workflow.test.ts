import assert from 'node:assert/strict'
import test from 'node:test'
import { accounts } from '../accounts/index.ts'
import {
  applyCommand,
  attention,
  committed,
  planningCoverage,
  signalsConflict,
  type Changes,
} from './index.ts'

const cove = accounts.find((account) => account.id === 'cove')!
const ember = accounts.find((account) => account.id === 'ember')!
const beacon = accounts.find((account) => account.id === 'beacon')!
const drift = accounts.find((account) => account.id === 'drift')!
const atlas = accounts.find((account) => account.id === 'atlas')!

function plan(account: typeof cove, owner = 'Alex Rivera') {
  return applyCommand({}, account, 0, {
    type: 'plan',
    action: 'checkIn',
    owner,
    followUp: '2026-11-25',
  })
}

test('missing adoption stays unknown', () => {
  assert.equal(drift.adoption, null)
  assert.equal(drift.reportingFailed, true)
  assert.equal(attention(drift), 'investigate')
})

test('Cove conflicts and Atlas does not take a slot by value', () => {
  assert.equal(signalsConflict(cove), true)
  assert.equal(attention(cove), 'review')
  assert.equal(atlas.value > cove.value, true)
  assert.equal(attention(atlas), 'steady')
})

test('an information request does not use a slot', () => {
  const work = applyCommand({}, drift, 0, {
    type: 'information',
    question: 'Ask for a corrected usage report.',
  })
  const changes: Changes = { drift: work }
  assert.equal(work.information?.includes('corrected'), true)
  assert.equal(committed(changes).length, 0)
  assert.equal(planningCoverage(changes).ready.length, 0)
})

test('a plan without an owner leaves the record unchanged', () => {
  assert.throws(
    () => applyCommand({}, cove, 0, { type: 'plan', action: 'resolveIssue', owner: ' ', followUp: '2026-11-25' }),
    { reason: 'ownerRequired' },
  )
})

test('the third commitment is rejected and an edit of an existing plan succeeds', () => {
  const first = plan(cove)
  const second = plan(ember)
  const changes = { cove: first, ember: second }
  assert.equal(committed(changes).length, 2)
  assert.throws(
    () => applyCommand(changes, beacon, 0, { type: 'plan', action: 'reconnect', owner: 'Alex Rivera', followUp: '2026-11-25' }),
    { reason: 'full' },
  )
  const edited = applyCommand(changes, ember, second.revision, {
    type: 'plan',
    action: 'budget',
    owner: 'Sam Patel',
    followUp: '2026-11-26',
  })
  assert.equal(edited.plan?.owner, 'Sam Patel')
  assert.equal(committed({ ...changes, ember: edited }).length, 2)
})

test('resolving Cove moves attention to monitoring and keeps the follow-up', () => {
  const saved = plan(cove)
  const resolved = applyCommand({ cove: saved }, cove, saved.revision, { type: 'resolve' })
  assert.equal(resolved.issueResolved, true)
  assert.equal(resolved.plan?.followUp, '2026-11-25')
  assert.equal(attention(cove, resolved), 'monitor')
  assert.equal(signalsConflict(cove, resolved), false)
  const completed = applyCommand({ cove: resolved }, cove, resolved.revision, { type: 'complete' })
  assert.equal(completed.plan?.status, 'completed')
  assert.equal(committed({ cove: completed }).length, 0)
  assert.equal(attention(cove, completed), 'steady')
})

test('planning coverage counts a timely intervention and ignores Atlas', () => {
  const saved = plan(cove)
  const coverage = planningCoverage({ cove: saved })
  assert.deepEqual(
    coverage.denominator.map((account) => account.id),
    ['ember', 'beacon', 'cove', 'drift'],
  )
  assert.deepEqual(
    coverage.ready.map((account) => account.id),
    ['cove'],
  )
})
