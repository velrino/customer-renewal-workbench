export type Account = {
  id: string
  name: string
  value: number
  days: number
  adoption: number | null
  /** Why adoption is null. Unknown usage is not stored as zero. */
  reportingFailed?: boolean
  previousAdoption?: number
  critical?: boolean
  budgetPending?: boolean
  sponsor: 'positive' | 'unreachable' | 'unknown' | 'pending'
}

export const accounts: Account[] = [
  {
    id: 'ember',
    name: 'Ember',
    value: 55000,
    days: 7,
    adoption: 0.35,
    budgetPending: true,
    sponsor: 'pending',
  },
  {
    id: 'beacon',
    name: 'Beacon',
    value: 18000,
    days: 14,
    adoption: 0.2,
    previousAdoption: 0.7,
    sponsor: 'unreachable',
  },
  {
    id: 'cove',
    name: 'Cove',
    value: 80000,
    days: 21,
    adoption: 0.8,
    critical: true,
    sponsor: 'positive',
  },
  {
    id: 'drift',
    name: 'Drift',
    value: 40000,
    days: 30,
    adoption: null,
    reportingFailed: true,
    sponsor: 'unknown',
  },
  {
    id: 'atlas',
    name: 'Atlas',
    value: 100000,
    days: 45,
    adoption: 0.85,
    sponsor: 'positive',
  },
  {
    id: 'field',
    name: 'Field',
    value: 25000,
    days: 60,
    adoption: 0.65,
    sponsor: 'positive',
  },
]
export const currency = {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
} as const

export const renewalWindowDays = 30

export function renewsSoon(account: Account) {
  return account.days >= 0 && account.days <= renewalWindowDays
}

export function signalValues(account: Account) {
  return { previous: account.previousAdoption ?? 0, current: account.adoption ?? 0 }
}
