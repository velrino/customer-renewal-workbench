'use client'

import { RelativeDate } from '@/shared/ui/relative-date'
import { clearWorkbenchPreferences, storageKey } from '@/shared/storage/local-storage'
import { usePreferenceRecord } from '@/shared/storage/local-storage/preferences/use-preference-record'
import { preferenceKeys } from '@/shared/storage/local-storage/preferences'

import { useEffect, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { QuickTour } from '@/shared/ui/quick-tour'
import { toast } from '@/shared/ui/toast'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Search } from 'lucide-react'
import { TextField } from '@/shared/ui/text-field'
import { useRenewalRange } from '@/shared/renewals/hooks/useRenewalRange'
import { DateRangePicker } from '@/shared/ui/date-range-picker'
import { MultiSelect } from '@/shared/ui/multi-select'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Navbar } from '../../layout/WorkbenchNavigation'
import { accounts, currency, type Account } from '@/shared/renewals/accounts'
import { Skeleton } from '@/shared/ui/skeleton'
import { useDashboardLoading } from './useDashboardLoading'
import { QueueSkeleton } from './components/DashboardSkeleton'
import { RenewalOverview } from './components/RenewalOverview'

import { AccountDecision } from './components/AccountDecision'
import { useRenewalWork } from '@/shared/renewals/hooks/useRenewalWork'
import {
  attention,
  attentionPriority,
  committed,
  evidenceKey,
  renewalDate,
  renewalWindowDays,
  today,
  sortedQueue,
  suggestedAction,
} from '@/shared/renewals/workflow'

const columns = ['name', 'status', 'evidence', 'renewal', 'adoption', 'value'] as const
const statusStyles = {
  review: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  investigate: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  monitor: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
  steady: 'bg-muted text-muted-foreground',
}
const statuses = ['review', 'investigate', 'monitor', 'steady'] as const
type QueueFilters = { query: string; filter: (typeof statuses)[number][] }
const emptyFilters: QueueFilters = { query: '', filter: [] }
const queuePreferenceKey = storageKey('tables', 'account-queue')

const focusTitle = (node: HTMLHeadingElement | null) => {
  node?.focus()
}
function followUpFor(days: number) {
  return renewalDate(Math.min(2, days))
}

export function Dashboard() {
  const referenceDay = today()
  const t = useTranslations('dashboard')
  const nav = useTranslations('nav')
  const { changes, ready, readError, retryRead, resetWork, save, saveTwo } = useRenewalWork()
  const loading = useDashboardLoading(ready)
  function retryDashboard() {
    loading.restart()
    return retryRead()
  }
  useEffect(() => {
    if (readError) toast.error(t('storageError'), { id: 'workbench-read-error', duration: Infinity })
    else toast.dismiss('workbench-read-error')
  }, [readError, t])
  const { prefs, update } = usePreferenceRecord(queuePreferenceKey)
  const query = typeof prefs.query === 'string' ? prefs.query.slice(0, 100) : ''
  const storedFilter = prefs.filter
  const filter = statuses.filter(status => Array.isArray(storedFilter) ? storedFilter.includes(status) : storedFilter === status)
  const sort = {
    column: columns.find(column => column === prefs.column) ?? 'renewal',
    direction: prefs.direction === 'descending' ? 'descending' : 'ascending',
  } as const
  const renewalDays = accounts.map(account => account.days)
  const portfolioRange = {
    from: new Date(renewalDate(Math.min(...renewalDays), referenceDay)),
    to: new Date(renewalDate(Math.max(...renewalDays), referenceDay)),
  }
  const { range, setRange } = useRenewalRange()
  const start = range?.from?.toISOString().slice(0, 10)
  const end = range?.to?.toISOString().slice(0, 10)
  const periodAccounts = sortedQueue(changes).filter(account => {
    const date = renewalDate(account.days, referenceDay)
    return (!start || date >= start) && (!end || date <= end)
  })
  const [racing, setRacing] = useState(false)
  const allocated = committed(changes)
  function compareAccounts(a: Account, b: Account) {
    let difference: number
    switch (sort.column) {
      case 'name': difference = a.name.localeCompare(b.name); break
      case 'status': difference = attentionPriority(a, changes) - attentionPriority(b, changes); break
      case 'evidence':
        difference = t('signals.' + evidenceKey(a, changes[a.id])).localeCompare(t('signals.' + evidenceKey(b, changes[b.id])))
        break
      case 'renewal': difference = a.days - b.days; break
      case 'value': difference = a.value - b.value; break
      case 'adoption':
        if (a.adoption == null || b.adoption == null) {
          return Number(a.adoption == null) - Number(b.adoption == null)
        }
        difference = a.adoption - b.adoption
        break
    }
    return (sort.direction === 'ascending' ? difference : -difference) || a.days - b.days
  }
  const fmt = useFormatter()
  const [account, setAccount] = useState<Account | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const [barQueue, setBarQueue] = useState<{ label: string; members: Account[] } | null>(null)
  const [choosing, setChoosing] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const table = useRef<HTMLTableElement>(null)
  function inspect(next: Account, button: HTMLButtonElement) {
    opener.current = button
    setAccount(next)
  }
  function adoption(a: Account) {
    if (a.adoption === null) return t('unknown')
    const current = fmt.number(a.adoption, { style: 'percent' })
    if (a.previousAdoption == null) return current
    return t('fell', {
      current,
      previous: fmt.number(a.previousAdoption, { style: 'percent' }),
    })
  }
  const [modalFilters, setModalFilters] = useState(emptyFilters)

  function renderQueue(rows: Account[], inDialog = false) {
    return (
      <div className="overflow-x-auto">
        <table
          ref={inDialog ? undefined : table}
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
                      onClick={() => update({
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
              const openAccount = (button: HTMLButtonElement) => inDialog ? setAccount(a) : inspect(a, button)
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
                    {t('signals.' + evidenceKey(a, changes[a.id]))}
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

  function renderQueueView(members: Account[], inDialog = false) {
    const current = inDialog ? modalFilters : { query, filter }
    const searchId = inDialog ? 'period-queue-search' : 'queue-search'
    function changeFilters(patch: Partial<typeof current>) {
      if (inDialog) setModalFilters(previous => ({ ...previous, ...patch }))
      else update(patch)
    }
    const visible = members.filter(
      (a) =>
        a.name.toLowerCase().includes(current.query.trim().toLowerCase()) &&
        (!current.filter.length || current.filter.includes(attention(a, changes[a.id]))),
    ).sort(compareAccounts)
    const candidates = members.filter(
      (item) =>
        attention(item, changes[item.id]) === 'review' &&
        changes[item.id]?.plan?.status !== 'active',
    )
    return (
      <div className="min-w-0 space-y-3">
        <div id={inDialog ? undefined : 'queue-filters'} className="flex flex-wrap items-center gap-2 text-sm">
          {(members.length > 1 || current.query !== '' || current.filter.length > 0) && (
            <>
              <div className="relative w-full sm:w-80 lg:w-96">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-2.5 z-10 size-4 text-muted-foreground"
                />
                <label className="sr-only" htmlFor={searchId}>{t('search')}</label>
                <TextField
                  id={searchId}
                  className="ps-9"
                  maxLength={100}
                  type="search"
                  placeholder={t('searchHint')}
                  value={current.query}
                  onValueChange={query => changeFilters({ query })}
                />
              </div>
              <MultiSelect
                label={t('filter')}
                allLabel={t('all')}
                summary={!current.filter.length ? t('all') : current.filter.length === 1
                  ? t('states.' + current.filter[0]) : t('selectedStatuses', { count: current.filter.length })}
                options={statuses.map(value => ({ value, label: t('states.' + value) }))}
                selected={current.filter}
                onChange={filter => changeFilters({ filter })}
              />
            </>
          )}
          <span className="ml-auto rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {t('used', { count: allocated.length })}
          </span>
          {allocated.length === 1 && candidates.length >= 2 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={!ready || racing}
              onClick={() => void runRace(candidates)}
            >
              {t('race', {
                first: candidates[0].name,
                second: candidates[1].name,
              })}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('order')}</p>
        {renderQueue(visible, inDialog)}
        {visible.length === 0 && (
          <div className="space-y-2 py-4 text-center">
            <p>{t('empty')}</p>
            <Button
              variant="outline"
              onClick={() => {
                if (!inDialog) setRange(undefined)
                changeFilters(emptyFilters)
              }}
            >
              {t('clear')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  async function runRace(candidates: Account[]) {
    const pair = candidates.slice(0, 2)
    if (racing || pair.length < 2 || allocated.length !== 1) return
    setRacing(true)
    try {
      const results = await saveTwo(
        pair.map((item) => ({
          account: item,
          revision: changes[item.id]?.revision ?? 0,
          command: {
            type: 'plan' as const,
            action: suggestedAction(item, changes[item.id]),
            owner: 'Capacity check',
            followUp: followUpFor(item.days),
          },
        })),
      )
      toast.message(t('raceResult'), {
        description: results
          .map((result) => {
            const name =
              accounts.find((a) => a.id === result.id)?.name ?? result.id
            return result.ok
              ? t('raceSaved', { name })
              : t('raceRejected', {
                  name,
                  reason: t('errors.' + (result.reason ?? 'storage')),
                })
          })
          .join(' '),
      })
    } catch {
      toast.error(t('errors.storage'))
    } finally {
      setRacing(false)
    }
  }
  return (
    <>
      <Navbar onReset={async () => {
        await resetWork()
        clearWorkbenchPreferences()
        window.location.reload()
      }} />
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight"
          >
            {nav('dashboard')}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {loading.complete ? (
              <>
                <QuickTour
                  autoStart
                  invitationKey={preferenceKeys.dashboardTour}
                  steps={[
                    {
                      target: 'renewal-date-range',
                      title: t('renewalRange'),
                      explanation: t('tourRange'),
                    },
                    {
                      target: 'metric-tracked',
                      title: t('tracked'),
                      explanation: t('tourAccounts'),
                    },
                    {
                      target: 'metric-due',
                      title: t('due'),
                      explanation: t('tourRenewals'),
                    },
                    {
                      target: 'metric-capacity',
                      title: t('capacity'),
                      explanation: t('tourCapacity'),
                    },
                    {
                      target: 'review-now',
                      title: t('attention'),
                      explanation: t('tourAttention'),
                    },
                    {
                      target: 'queue-filters',
                      title: t('queue'),
                      explanation: t('tourQueue'),
                    },
                  ]}
                />
                <DateRangePicker id="renewal-date-range" label={t('renewalRange')} value={range} onChange={setRange} fullRange={portfolioRange} />
              </>
            ) : !readError && <Skeleton className="h-9 w-56" />}
          </div>
        </div>
        {!readError ? (
          <>
            {!loading.complete && <span role="status" className="sr-only">{t('unavailable')}</span>}
            <RenewalOverview
              isReady={loading.isReady}
              onOpenQueue={(label, members, button) => {
                opener.current = button
                setModalFilters(emptyFilters)
                setBarQueue({ label, members })
              }}
              onShowUpcoming={() => {
                const deadline = new Date(renewalDate(renewalWindowDays, referenceDay))
                setRange({ from: range?.from ?? new Date(referenceDay), to: range && range.to < deadline ? range.to : deadline })
                update(emptyFilters)
              }}
              periodAccounts={periodAccounts}
              inspect={inspect}
              changes={changes}
              choose={(button) => {
                opener.current = button
                setChoosing(true)
              }}
            />
            <Card id="account-queue" tabIndex={-1}>
              <CardHeader>
                <CardTitle>{t('queue')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading.isReady('queue') ? renderQueueView(periodAccounts) : <QueueSkeleton />}
              </CardContent>
            </Card>
          </>
        ) : (
          <Button variant="outline" onClick={() => void retryDashboard()}>{t('retry')}</Button>
        )}
        <Dialog
          open={choosing || account !== null || barQueue !== null}
          onOpenChange={(open) => {
            if (!open) {
              setChoosing(false)
              setAccount(null)
              setBarQueue(null)
            }
          }}
        >
          <DialogContent
            className={barQueue && !account ? 'max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-[min(80rem,calc(100vw-3rem))]' : 'max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const target = opener.current?.isConnected
                ? opener.current
                : heading.current
              target?.focus()
            }}
          >
            {barQueue && !account ? (
              <>
                <DialogHeader>
                  <DialogTitle ref={focusTitle} tabIndex={-1}>{t('queue')}</DialogTitle>
                  <DialogDescription>{barQueue.label} · {fmt.number(barQueue.members.reduce((sum, a) => sum + a.value, 0), currency)}</DialogDescription>
                </DialogHeader>
                {renderQueueView(barQueue.members, true)}
              </>
            ) : choosing ? (
              <>
                <DialogHeader>
                  <DialogTitle>{t('chooseAccount')}</DialogTitle>
                  <DialogDescription>
                    {t('chooseAccountHint')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  {periodAccounts.map((a) => (
                    <Button
                      key={a.id}
                      variant="outline"
                      className="h-12 w-full justify-between"
                      onClick={() => {
                        opener.current ??=
                          table.current?.querySelector<HTMLButtonElement>(
                            `[data-account="${a.id}"]`,
                          ) ?? null
                        setAccount(a)
                        setChoosing(false)
                      }}
                    >
                      <span>{a.name}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <RelativeDate date={renewalDate(a.days, referenceDay)} referenceDay={referenceDay} />
                        <ChevronRight />
                      </span>
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              account && (
                <>
                  <DialogHeader>
                    <DialogTitle tabIndex={-1} ref={focusTitle}>
                      {account.name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      {t('detail', { name: account.name })}
                    </DialogDescription>
                  </DialogHeader>
                  {barQueue && <Button variant="outline" onClick={() => setAccount(null)}>{t('backToQueue')}</Button>}
                  <AccountDecision
                    key={account.id}
                    account={account}
                    work={changes[account.id]}
                    save={save}
                    ready={ready}
                    readError={readError}
                    retry={retryDashboard}
                    used={allocated.length}
                  >
                    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-3">
                      {([
                        [t('renewal'), <RelativeDate key="renewal" date={renewalDate(account.days, referenceDay)} referenceDay={referenceDay} showExact />],
                        [t('value'), fmt.number(account.value, currency)],
                        [t('adoptionDetail'), adoption(account)],
                        [
                          t('signal'),
                          t(
                            'signals.' +
                              evidenceKey(account, changes[account.id]),
                          ),
                        ],
                      ] as const).map(([name, value]) => (
                        <div key={name} className={name === t('signal') ? 'col-span-full border-t pt-2' : undefined}>
                          <dt className="text-muted-foreground">{name}</dt>
                          <dd className="mt-1 font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </AccountDecision>
                </>
              )
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  )
}
