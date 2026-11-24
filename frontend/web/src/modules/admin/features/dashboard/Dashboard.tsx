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
import { SelectDropdown } from '@/shared/ui/select-dropdown'
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
  signalsConflict,
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
  const { changes, ready, readError, refresh, resetWork, save, saveTwo } = useRenewalWork()
  useEffect(() => {
    if (readError) toast.error(t('storageError'), { id: 'workbench-read-error', duration: Infinity })
    else toast.dismiss('workbench-read-error')
  }, [readError, t])
  const { prefs, update } = usePreferenceRecord(queuePreferenceKey)
  const query = typeof prefs.query === 'string' ? prefs.query.slice(0, 100) : ''
  const filter = ['review', 'investigate', 'monitor', 'steady'].find(status => status === prefs.filter) ?? 'all'
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
  const visible = periodAccounts.filter(
    (a) =>
      a.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (filter === 'all' || attention(a, changes[a.id]) === filter),
  ).sort(compareAccounts)

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
  const candidates = periodAccounts.filter(
    (item) =>
      attention(item, changes[item.id]) === 'review' &&
      changes[item.id]?.plan?.status !== 'active',
  )

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
            {rows.map((a) => (
              <tr
                className="border-b last:border-0 hover:bg-muted/50"
                key={a.id}
              >
                <td className="p-2">
                  <button
                    data-account={a.id}
                    className="rounded-sm py-1 font-medium hover:underline"
                    onClick={e => inDialog ? setAccount(a) : inspect(a, e.currentTarget)}
                  >
                    {a.name}
                  </button>
                </td>
                <td className="min-w-36 p-2">
                  <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[attention(a, changes[a.id])]}`}>
                    {t('states.' + attention(a, changes[a.id]))}
                  </span>
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
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  async function runRace() {
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
      toast(t('raceResult'), {
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
          </div>
        </div>
        <RenewalOverview
          onOpenQueue={(label, members, button) => {
            opener.current = button
            setBarQueue({ label, members })
          }}
          onShowUpcoming={() => {
            const deadline = new Date(renewalDate(renewalWindowDays, referenceDay))
            setRange({ from: range?.from ?? new Date(referenceDay), to: range && range.to < deadline ? range.to : deadline })
            update({ query: '', filter: 'all' })
          }}
          periodAccounts={periodAccounts}
          inspect={inspect}
          changes={changes}
          choose={(button) => {
            opener.current = button
            setChoosing(true)
          }}
        />
        {readError && (
          <Button variant="outline" onClick={() => void refresh()}>
            {t('retry')}
          </Button>
        )}
        <Card id="account-queue" tabIndex={-1}>
          <CardHeader>
            <CardTitle>{t('queue')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div id="queue-filters" className="flex flex-wrap items-center gap-2 text-sm">
              <div className="relative w-full sm:w-56">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-2.5 z-10 size-4 text-muted-foreground"
                />
                <label className="sr-only" htmlFor="queue-search">{t('search')}</label>
                <TextField
                  id="queue-search"
                  className="ps-9"
                  maxLength={100}
                  type="search"
                  placeholder={t('searchHint')}
                  value={query}
                  onValueChange={query => update({ query })}
                />
              </div>
              <SelectDropdown
                label={t('filter')}
                hideLabel
                value={filter}
                onValueChange={filter => update({ filter })}
                items={[
                  { value: 'all', label: t('all') },
                  ...['review', 'investigate', 'monitor', 'steady'].map(value => ({
                    value, label: t('states.' + value),
                  })),
                ]}
              />
              <span className="ml-auto rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {t('used', { count: allocated.length })}
              </span>
              {allocated.length === 1 && candidates.length >= 2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!ready || racing}
                  onClick={() => void runRace()}
                >
                  {t('race', {
                    first: candidates[0].name,
                    second: candidates[1].name,
                  })}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('order')}</p>
            {renderQueue(visible)}
            {visible.length === 0 && (
              <div className="space-y-2 py-4 text-center">
                <p>{t('empty')}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRange(undefined)
                    update({ query: '', filter: 'all' })
                  }}
                >
                  {t('clear')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
            className={barQueue && !account ? 'max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-4xl' : 'max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'}
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
                {renderQueue([...barQueue.members].sort(compareAccounts), true)}
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
                  {signalsConflict(account, changes[account.id]) && (
                    <p className="text-sm">{t('conflict')}</p>
                  )}
                  {barQueue && <Button variant="outline" onClick={() => setAccount(null)}>{t('backToQueue')}</Button>}
                  <AccountDecision
                    key={account.id}
                    account={account}
                    work={changes[account.id]}
                    save={save}
                    ready={ready}
                    readError={readError}
                    retry={refresh}
                    used={allocated.length}
                  />
                </>
              )
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  )
}
