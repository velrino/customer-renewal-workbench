import { accounts, type Account } from '../accounts/index.ts'

export function today() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const capacity = 2
export const budgetHorizonDays = 14
export const adoptionDropPoints = 30
export const renewalWindowDays = 30
export const actions = [
  'resolveIssue',
  'budget',
  'reconnect',
  'adoption',
  'checkIn',
] as const
export type Action = (typeof actions)[number]
export type Plan = {
  status: 'active' | 'completed'
  action: Action
  owner: string
  followUp: string
  evidence: string
  savedAt: string
}
export type AccountWork = {
  id: string
  revision: number
  issueResolved?: boolean
  plan?: Plan
  information?: string
}
export type Changes = Record<string, AccountWork>
export type Command =
  | { type: 'plan'; action: Action; owner: string; followUp: string }
  | { type: 'information'; question: string }
  | { type: 'resolve' | 'complete' }

export function renewalDate(days: number, referenceDay = today()) {
  const date = new Date(referenceDay + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export type Attention = 'review' | 'investigate' | 'monitor' | 'reviewed' | 'steady'

export function attention(a: Account, work?: AccountWork): Attention {
  const decline =
    a.previousAdoption != null &&
    a.adoption != null &&
    a.previousAdoption - a.adoption + Number.EPSILON >= adoptionDropPoints / 100
  if (
    (a.critical && !work?.issueResolved) ||
    (a.budgetPending && a.days <= budgetHorizonDays) ||
    (decline && a.sponsor === 'unreachable')
  )
    return work?.plan?.status === 'completed' ? 'reviewed' : 'review'
  if (a.adoption == null || a.sponsor === 'unknown') return 'investigate'
  if (work?.plan?.status === 'active') return 'monitor'
  return 'steady'
}

export function signalsConflict(a: Account, work?: AccountWork) {
  return Boolean(
    a.critical &&
      !work?.issueResolved &&
      a.sponsor === 'positive' &&
      a.adoption != null &&
      a.adoption >= 0.5,
  )
}

export function evidenceKey(a: Account, work?: AccountWork) {
  return a.id === 'cove' && work?.issueResolved ? 'coveResolved' : a.id
}

export function suggestedAction(account: Account, work?: AccountWork): Action {
  if (account.critical && !work?.issueResolved) return 'resolveIssue'
  if (account.budgetPending) return 'budget'
  if (account.sponsor === 'unreachable') return 'reconnect'
  return 'checkIn'
}

export function committed(changes: Changes) {
  return accounts.filter((a) => changes[a.id]?.plan?.status === 'active')
}

const attentionOrder = { review: 0, investigate: 1, monitor: 2, reviewed: 3, steady: 4 }

export function attentionPriority(a: Account, changes: Changes) {
  return attentionOrder[attention(a, changes[a.id])]
}

export function sortedQueue(changes: Changes) {
  return [...accounts].sort(
    (a, b) =>
      attentionPriority(a, changes) - attentionPriority(b, changes) ||
      a.days - b.days,
  )
}

export function planningCoverage(changes: Changes, portfolio = accounts) {
  const denominator = portfolio.filter((a) => a.days <= renewalWindowDays)
  const ready = denominator.filter((a) => {
    const plan = changes[a.id]?.plan
    return (
      plan != null &&
      plan.owner.trim().length > 0 &&
      plan.followUp <= renewalDate(a.days) &&
      plan.evidence.length > 0
    )
  })
  return { ready, denominator }
}

export type Failure =
  | 'ownerRequired'
  | 'invalidDate'
  | 'questionRequired'
  | 'full'
  | 'changed'
  | 'storage'
export class WorkflowError extends Error {
  readonly reason: Failure
  constructor(reason: Failure) {
    super(reason)
    this.reason = reason
  }
}

export function applyCommand(
  changes: Changes,
  a: Account,
  revision: number,
  command: Command,
): AccountWork {
  const previous = changes[a.id]
  if ((previous?.revision ?? 0) !== revision) throw new WorkflowError('changed')
  const work = { ...previous, id: a.id, revision: revision + 1 }
  switch (command.type) {
    case 'plan': {
      if (!command.owner.trim()) throw new WorkflowError('ownerRequired')
      const referenceDay = today()
      const date = new Date(command.followUp + 'T00:00:00Z')
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== command.followUp ||
        command.followUp < referenceDay ||
        command.followUp > renewalDate(a.days, referenceDay)
      )
        throw new WorkflowError('invalidDate')
      if (
        previous?.plan?.status !== 'active' &&
        committed(changes).length >= capacity
      )
        throw new WorkflowError('full')
      work.plan = {
        status: 'active',
        action: command.action,
        owner: command.owner.trim(),
        followUp: command.followUp,
        evidence: evidenceKey(a, previous),
        savedAt: new Date().toISOString(),
      }
      break
    }
    case 'information':
      if (!command.question.trim()) throw new WorkflowError('questionRequired')
      work.information = command.question.trim()
      break
    case 'resolve':
      if (!a.critical || work.issueResolved) throw new WorkflowError('changed')
      work.issueResolved = true
      break
    case 'complete':
      if (work.plan?.status !== 'active') throw new WorkflowError('changed')
      work.plan = { ...work.plan, status: 'completed' }
      break
  }
  return work
}
