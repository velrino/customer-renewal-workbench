'use client'

import { preferenceKeys } from '@/shared/storage/local-storage/preferences'

import { useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { QuickTour } from '@/shared/ui/quick-tour'
import { toast } from '@/shared/ui/toast'
import { ChevronRight, Search } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Navbar, type DashboardView } from '../../layout/WorkbenchNavigation'
import { accounts, currency, renewsSoon, type Account } from '@/shared/renewals/accounts'
import { RenewalOverview } from './components/RenewalOverview'

import { AccountDecision } from './components/AccountDecision'
import { useRenewalWork } from '@/shared/renewals/hooks/useRenewalWork'
import {
  attention,
  committed,
  evidenceKey,
  renewalDate,
  signalsConflict,
  sortedQueue,
  suggestedAction,
} from '@/shared/renewals/workflow'

const focusTitle = (node: HTMLHeadingElement | null) => {
  node?.focus()
}
function followUpFor(days: number) {
  const suggested = '2026-11-25'
  const renewal = renewalDate(days)
  return suggested <= renewal ? suggested : renewal
}

export function Dashboard({
  view,
  soonOnly = false,
}: {
  view: DashboardView
  soonOnly?: boolean
}) {
  const t = useTranslations('dashboard')
  const nav = useTranslations('nav')
  const { changes, ready, readError, refresh, save, saveTwo } = useRenewalWork()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [racing, setRacing] = useState(false)
  const allocated = committed(changes)
  const visible = sortedQueue(changes).filter(
    (a) =>
      (!soonOnly || renewsSoon(a)) &&
      a.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (filter === 'all' || attention(a, changes[a.id]) === filter),
  )
  const fmt = useFormatter()
  const [account, setAccount] = useState<Account | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const [choosing, setChoosing] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const table = useRef<HTMLTableElement>(null)
  const candidates = sortedQueue(changes).filter(
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
      <Navbar view={view} />
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight"
          >
            {nav(view)}
          </h1>
          {view === 'dashboard' && (
            <QuickTour
              autoStart
              invitationKey={preferenceKeys.dashboardTour}
              steps={[
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
          )}
        </div>
        {view === 'dashboard' && (
          <RenewalOverview
            inspect={inspect}
            changes={changes}
            choose={(button) => {
              opener.current = button
              setChoosing(true)
            }}
          />
        )}
        {readError && (
          <p role="alert">
            {t('storageError')}{' '}
            <Button variant="outline" onClick={() => void refresh()}>
              {t('retry')}
            </Button>
          </p>
        )}
        <Card>
          {view === 'dashboard' && (
            <CardHeader>
              <CardTitle>{t('queue')}</CardTitle>
            </CardHeader>
          )}
          <CardContent className="space-y-3">
            <div id="queue-filters" className="flex flex-wrap items-center gap-2 text-sm">
              <label className="relative w-full sm:w-56">
                <Search
                  aria-hidden
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                />
                <span className="sr-only">{t('search')}</span>
                <input
                  className="block h-9 w-full rounded-md border bg-background pl-9 pr-3"
                  type="search"
                  placeholder={t('searchHint')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">{t('filter')}</span>
                <select
                  className="block h-9 rounded-md border bg-background px-3"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">{t('all')}</option>
                  {['review', 'investigate', 'monitor', 'steady'].map((k) => (
                    <option key={k} value={k}>
                      {t('states.' + k)}
                    </option>
                  ))}
                </select>
              </label>
              {soonOnly && (
                <Button
                  variant="outline"
                  onClick={() =>
                    window.history.replaceState(
                      null,
                      '',
                      '/dashboard/account-queue',
                    )
                  }
                  aria-label={t('removeMonth')}
                >
                  {t('month')} ×
                </Button>
              )}
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
            <div className="overflow-x-auto">
              <table
                ref={table}
                aria-label={t('queue')}
                className="w-full text-left text-sm"
              >
                <thead className="border-b text-muted-foreground">
                  <tr>
                    {(
                      [
                        'name',
                        'status',
                        'renewal',
                        'adoption',
                        'value',
                      ] as const
                    ).map((k) => (
                      <th className="p-2 font-medium last:text-right" key={k}>
                        {t(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((a) => (
                    <tr
                      className="border-b last:border-0 hover:bg-muted/50"
                      key={a.id}
                    >
                      <td className="p-2">
                        <button
                          data-account={a.id}
                          className="rounded-sm py-1 font-medium hover:underline"
                          onClick={(e) => inspect(a, e.currentTarget)}
                        >
                          {a.name}
                        </button>
                      </td>
                      <td className="min-w-36 p-2">
                        <span className="font-medium">
                          {t('states.' + attention(a, changes[a.id]))}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {t('signals.' + evidenceKey(a, changes[a.id]))}
                        </p>
                        {changes[a.id]?.plan?.status === 'active' && (
                          <small>
                            {t('agreedPlan')} · {changes[a.id].plan?.owner}
                          </small>
                        )}
                      </td>
                      <td className="p-2">{t('days', { count: a.days })}</td>
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
            {visible.length === 0 && (
              <div className="space-y-2 py-4 text-center">
                <p>{t('empty')}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                    if (soonOnly)
                      window.history.replaceState(
                        null,
                        '',
                        '/dashboard/account-queue',
                      )
                  }}
                >
                  {t('clear')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog
          open={choosing || account !== null}
          onOpenChange={(open) => {
            if (!open) {
              setChoosing(false)
              setAccount(null)
            }
          }}
        >
          <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const target = opener.current?.isConnected
                ? opener.current
                : heading.current
              target?.focus()
            }}
          >
            {choosing ? (
              <>
                <DialogHeader>
                  <DialogTitle>{t('chooseAccount')}</DialogTitle>
                  <DialogDescription>
                    {t('chooseAccountHint')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  {accounts.map((a) => (
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
                        {t('days', { count: a.days })}
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
                    <DialogDescription>
                      {t('detail', { name: account.name })}
                    </DialogDescription>
                  </DialogHeader>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      [t('renewal'), t('days', { count: account.days })],
                      [t('value'), fmt.number(account.value, currency)],
                      [t('adoptionDetail'), adoption(account)],
                      [
                        t('signal'),
                        t(
                          'signals.' +
                            evidenceKey(account, changes[account.id]),
                        ),
                      ],
                    ].map(([name, value]) => (
                      <div key={name}>
                        <dt className="text-muted-foreground">{name}</dt>
                        <dd className="mt-1 font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {signalsConflict(account, changes[account.id]) && (
                    <p className="text-sm">{t('conflict')}</p>
                  )}
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
