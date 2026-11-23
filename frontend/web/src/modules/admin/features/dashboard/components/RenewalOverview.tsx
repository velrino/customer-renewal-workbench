import {
  Banknote,
  CalendarDays,
  Users,
  Target,
  ChevronRight,
} from 'lucide-react'
import { AnimatedNumber } from '@/shared/ui/animated-number'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/shared/ui/card'
import { accounts, currency, renewsSoon, type Account } from '@/shared/renewals/accounts'

import {
  attention,
  committed,
  evidenceKey,
  planningCoverage,
  type Changes,
} from '@/shared/renewals/workflow'

export function RenewalOverview({
  inspect,
  choose,
  changes,
}: {
  choose: (button: HTMLButtonElement) => void
  changes: Changes
  inspect: (a: Account, opener: HTMLButtonElement) => void
}) {
  const t = useTranslations('dashboard')
  const total = accounts.reduce((sum, a) => sum + a.value, 0)
  const allocated = committed(changes)
  const coverage = planningCoverage(changes)
  const metrics = [
    {
      key: 'tracked',
      note: 'chooseAccount',
      value: accounts.length,
      icon: Users,
    },
    {
      key: 'portfolio',
      note: 'annual',
      value: total,
      icon: Banknote,
    },
    {
      key: 'due',
      note: 'month',
      value: accounts.filter(renewsSoon).length,
      icon: CalendarDays,
    },
    {
      key: 'capacity',
      note: 'slots',
      value: allocated.length,
      icon: Target,
    },
  ] as const
  const periods = [1, 16, 31, 46].map((start) => ({
    start,
    end: start + 14,
    value: accounts
      .filter((a) => a.days >= start && a.days <= start + 14)
      .reduce((sum, a) => sum + a.value, 0),
  }))
  const max = Math.max(...periods.map((p) => p.value))
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ key, note, value, icon: Icon }) => (
          <Card key={key} id={'metric-' + key} className="relative gap-2">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {key === 'tracked' ? (
                  <button
                    className="after:absolute after:inset-0 after:rounded-xl hover:underline"
                    aria-haspopup="dialog"
                    onClick={(event) => choose(event.currentTarget)}
                  >
                    {t(key)}
                  </button>
                ) : key === 'due' ? (
                  <Link
                    className="after:absolute after:inset-0 after:rounded-xl hover:underline"
                    href="/dashboard/account-queue?renewal=30d"
                  >
                    {t(key)}
                  </Link>
                ) : (
                  t(key)
                )}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {key === 'capacity' ? (
                  t.rich('capacityCount', {
                    count: value,
                    number: () => <AnimatedNumber value={value} />,
                  })
                ) : (
                  <AnimatedNumber
                    value={value}
                    options={key === 'portfolio' ? currency : undefined}
                  />
                )}
              </p>
              {key === 'capacity' && allocated.length > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {allocated.map((a) => (
                    <button
                      key={a.id}
                      className="text-sm underline underline-offset-2"
                      aria-label={t('openPlan', { name: a.name })}
                      onClick={(e) => inspect(a, e.currentTarget)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {key === 'due'
                    ? t('coverageShort', {
                        ready: coverage.ready.length,
                        total: coverage.denominator.length,
                      })
                    : t(note)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>{t('calendar')}</CardTitle>
            <CardDescription>{t('calendarHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid h-48 grid-cols-4 gap-3">
              {periods.map(({ start, end, value }) => (
                <div
                  key={start}
                  className="flex min-w-0 flex-col items-center justify-end gap-2"
                >
                  <span className="text-xs font-medium tabular-nums">
                    <AnimatedNumber value={value} options={currency} />
                  </span>
                  <div
                    className="w-3/5 max-w-20 rounded-t bg-primary"
                    style={{ height: Math.round((value / max) * 120) }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t('period', { start, end })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card id="review-now" className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t('attention')}</CardTitle>
            <CardDescription>{t('attentionHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {accounts.filter((a) => attention(a, changes[a.id]) === 'review')
              .length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noReview')}</p>
            )}
            {accounts
              .filter((a) => attention(a, changes[a.id]) === 'review')
              .map((a) => (
                <button
                  key={a.id}
                  className="flex w-full items-center gap-3 rounded-md py-2 text-left hover:bg-accent"
                  onClick={(e) => inspect(a, e.currentTarget)}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {a.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm">{a.name}</strong>
                    <span className="block text-xs text-muted-foreground">
                      {t('days', { count: a.days })} ·{' '}
                      {t('signals.' + evidenceKey(a, changes[a.id]))}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
