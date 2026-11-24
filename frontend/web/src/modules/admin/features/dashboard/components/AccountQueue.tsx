import type { Ref } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { RelativeDate } from '@/shared/ui/relative-date'
import { signalValues, currency, type Account } from '@/shared/renewals/accounts'
import { attention, evidenceKey, renewalDate, type Changes } from '@/shared/renewals/workflow'

export const columns = ['name', 'status', 'evidence', 'renewal', 'adoption', 'value'] as const
const statusStyles = {
  review: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-white',
  investigate: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  monitor: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
  reviewed: 'bg-green-700 text-white',
  steady: 'bg-muted text-muted-foreground',
}

type Sort = { column: (typeof columns)[number]; direction: 'ascending' | 'descending' }

export function AccountQueue({ rows, tableRef, sort, onSort, changes, onInspect, adoption, referenceDay }: {
  rows: Account[]
  tableRef?: Ref<HTMLTableElement>
  sort: Sort
  onSort: (sort: Sort) => void
  changes: Changes
  onInspect: (account: Account, button: HTMLButtonElement) => void
  adoption: (account: Account) => string
  referenceDay: string
}) {
  const t = useTranslations('dashboard')
  const fmt = useFormatter()
  return (
    <div className="overflow-x-auto">
      <table
        ref={tableRef}
        aria-label={t('queue')}
        className="w-full text-left text-sm"
      >
        <thead className="border-b text-muted-foreground">
          <tr>
            {columns.map(column => {
              const active = sort.column === column
              const Icon = !active ? ArrowUpDown : sort.direction === 'ascending' ? ArrowUp : ArrowDown
              return (
                <th key={column} scope="col" aria-sort={active ? sort.direction : undefined}
                  className="p-2 font-medium last:text-right">
                  <button type="button"
                    className="inline-flex items-center gap-1 rounded-sm hover:text-foreground"
                    onClick={() => onSort({
                      column,
                      direction: active && sort.direction === 'ascending' ? 'descending' : 'ascending',
                    })}>
                    {t(column)}
                    <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(a => {
            const status = attention(a, changes[a.id])
            const badge = `mb-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`
            const openAccount = (button: HTMLButtonElement) => onInspect(a, button)
            return (
            <tr
              className="border-b last:border-0 hover:bg-muted/50"
              key={a.id}
            >
              <td className="p-2">
                <button
                  data-account={a.id}
                  className="rounded-sm py-1 font-medium hover:underline"
                  onClick={e => openAccount(e.currentTarget)}
                >
                  {a.name}
                </button>
              </td>
              <td className="min-w-36 p-2">
                {status === 'review' ? (
                  <button type="button" className={badge + ' hover:underline focus-visible:outline-ring'}
                    aria-label={t('reviewAccount', { name: a.name })} onClick={e => openAccount(e.currentTarget)}>
                    {t('states.review')}
                  </button>
                ) : <span className={badge}>{t('states.' + status)}</span>}
              </td>
              <td className="min-w-40 p-2">
                <p className="text-xs text-muted-foreground">
                  {t('signals.' + evidenceKey(a, changes[a.id]), signalValues(a))}
                </p>
                {changes[a.id]?.plan?.status === 'active' && (
                  <small>
                    {t('agreedPlan')} · {changes[a.id].plan?.owner}
                  </small>
                )}
              </td>
              <td className="p-2"><RelativeDate date={renewalDate(a.days, referenceDay)} referenceDay={referenceDay} /></td>
              <td className="p-2">
                {adoption(a)}
                {a.adoption === null && a.reportingFailed && (
                  <p className="text-xs text-muted-foreground">
                    {t('reportingFailed')}
                  </p>
                )}
              </td>
              <td className="p-2 text-right tabular-nums">
                {fmt.number(a.value, currency)}
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
