import assert from 'node:assert/strict'
import test from 'node:test'
import { accounts } from '../accounts/index.ts'
import {
  applyCommand,
  attention,
  committed,
  planningCoverage,
  signalsConflict,
  renewalDate,
  suggestedAction,
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
    followUp: renewalDate(2),
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
    () => applyCommand({}, cove, 0, { type: 'plan', action: 'resolveIssue', owner: ' ', followUp: renewalDate(2) }),
    { reason: 'ownerRequired' },
  )
})

test('the third commitment is rejected and an edit of an existing plan succeeds', () => {
  const first = plan(cove)
  const second = plan(ember)
  const changes = { cove: first, ember: second }
  assert.equal(committed(changes).length, 2)
  assert.throws(
    () => applyCommand(changes, beacon, 0, { type: 'plan', action: 'reconnect', owner: 'Alex Rivera', followUp: renewalDate(2) }),
    { reason: 'full' },
  )
  const edited = applyCommand(changes, ember, second.revision, {
    type: 'plan',
    action: 'budget',
    owner: 'Sam Patel',
    followUp: renewalDate(3),
  })
  assert.equal(edited.plan?.owner, 'Sam Patel')
  assert.equal(committed({ ...changes, ember: edited }).length, 2)
})

test('completing an intervention removes the account from review while preserving its concern', () => {
  for (const account of [ember, beacon, cove]) {
    const saved = plan(account)
    assert.equal(attention(account, saved), 'review')
    const completed = applyCommand({ [account.id]: saved }, account, saved.revision, { type: 'complete' })
    assert.equal(attention(account, completed), 'reviewed')
    assert.equal(completed.plan?.evidence, saved.plan?.evidence)
    assert.equal(committed({ [account.id]: completed }).length, 0)
  }
})

test('resolving Cove moves attention to monitoring and keeps the follow-up', () => {
  const saved = plan(cove)
  const resolved = applyCommand({ cove: saved }, cove, saved.revision, { type: 'resolve' })
  assert.equal(resolved.issueResolved, true)
  assert.equal(resolved.plan?.followUp, renewalDate(2))
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

test('an unreachable sponsor triggers review at an actual 30-point drop', () => {
  for (const [current, expected] of [[0.398, 'steady'], [0.396, 'review'], [0.395, 'review']] as const) {
    assert.equal(attention({ ...beacon, previousAdoption: 0.696, adoption: current }), expected)
  }
})

test('a new intervention uses current evidence after an issue is resolved', () => {
  const resolved = applyCommand({}, cove, 0, { type: 'resolve' })
  assert.equal(suggestedAction(cove), 'resolveIssue')
  assert.equal(suggestedAction(cove, resolved), 'checkIn')
})

test('editing an active plan keeps its original evidence and timestamp until a new intervention starts', () => {
  const saved = plan(cove)
  const originalTime = '2026-01-01T00:00:00Z'
  saved.plan!.savedAt = originalTime
  const resolved = applyCommand({ cove: saved }, cove, saved.revision, { type: 'resolve' })
  const command = { type: 'plan', action: 'checkIn', owner: 'New owner', followUp: renewalDate(1) } as const
  const edited = applyCommand({ cove: resolved }, cove, resolved.revision, command)
  assert.equal(edited.plan?.evidence, 'cove')
  assert.equal(edited.plan?.savedAt, originalTime)
  assert.equal(edited.plan?.owner, command.owner)
  const completed = applyCommand({ cove: edited }, cove, edited.revision, { type: 'complete' })
  const fresh = applyCommand({ cove: completed }, cove, completed.revision, command)
  assert.equal(fresh.plan?.evidence, 'coveResolved')
  assert.notEqual(fresh.plan?.savedAt, originalTime)
})
