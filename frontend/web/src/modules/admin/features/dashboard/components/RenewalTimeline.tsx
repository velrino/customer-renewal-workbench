import * as Tabs from '@radix-ui/react-tabs'
import { useFormatter, useTranslations } from 'next-intl'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { currency, type Account } from '@/shared/renewals/accounts'
import { renewalDate } from '@/shared/renewals/workflow'

const intervals = ['daily', 'monthly', 'yearly'] as const
type Interval = (typeof intervals)[number]
export type OpenTimelineQueue = (label: string, accounts: Account[], opener: HTMLButtonElement) => void
type TimelineProps = { accounts: Account[]; referenceDay: string; onOpenQueue: OpenTimelineQueue }

export function RenewalTimeline({ interval, onIntervalChange, ...props }: TimelineProps & {
  interval: unknown
  onIntervalChange: (interval: string) => void
}) {
  const t = useTranslations('dashboard')
  return (
    <Tabs.Root value={intervals.find(option => option === interval) ?? 'daily'} onValueChange={onIntervalChange}>
      <Tabs.List aria-label={t('timelineGrouping')} className="mb-4 grid w-full grid-cols-3 rounded-lg bg-muted p-1">
        {intervals.map(interval => (
          <Tabs.Trigger key={interval} value={interval}
            className="rounded-md px-3 py-1 text-sm text-muted-foreground focus-visible:outline-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            {t('interval.' + interval)}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {intervals.map(interval => (
        <Tabs.Content key={interval} value={interval}>
          <TimelineChart {...props} interval={interval} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}

function TimelineChart({ accounts, referenceDay, interval, onOpenQueue }: TimelineProps & { interval: Interval }) {
  const fmt = useFormatter()
  const t = useTranslations('dashboard')
  if (!accounts.length) {
    return <p role="status" className="grid min-h-48 place-items-center text-sm text-muted-foreground">{t('emptyTimeline')}</p>
  }

  function periodLabel(period: string, full = false) {
    const options: Pick<Intl.DateTimeFormatOptions, 'day' | 'month' | 'year'> = interval === 'daily'
      ? { day: 'numeric', month: full ? 'long' : 'short', year: full ? 'numeric' : undefined }
      : interval === 'monthly'
        ? { month: full ? 'long' : 'short', year: 'numeric' }
        : { year: 'numeric' }
    return fmt.dateTime(new Date(period), { ...options, timeZone: 'UTC' })
  }

  const byDate = new Map<string, { total: number; members: Account[] }>()
  for (const account of accounts) {
    const day = renewalDate(account.days, referenceDay)
    const period = interval === 'daily' ? day : day.slice(0, interval === 'monthly' ? 7 : 4)
    const group = byDate.get(period) ?? { total: 0, members: [] }
    group.total += account.value
    group.members.push(account)
    byDate.set(period, group)
  }
  const periods = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  const rawStep = Math.max(1, ...periods.map(([, group]) => group.total)) / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = Math.ceil(rawStep / magnitude) * magnitude
  const ticks = [4, 3, 2, 1, 0]
  const columns = { gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))` }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 pt-2">
      <div aria-hidden="true" className="relative h-60 sm:h-72 text-right text-xs tabular-nums text-muted-foreground">
        {ticks.map(tick => (
          <div key={tick} className="relative -translate-y-1/2" style={{ height: 0, top: `${(4 - tick) * 25}%` }}>
            <span className="inline-block -translate-y-1/2">{fmt.number(tick * step, { ...currency, notation: 'compact' })}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: periods.length * (interval === 'monthly' ? 72 : 45) }}>
          <div className="relative grid h-60 sm:h-72 items-end justify-items-center border-s border-b" style={columns}>
            {ticks.slice(0, -1).map(tick => (
              <div key={tick} className="pointer-events-none absolute inset-x-0 border-t border-dashed" style={{ top: `${(4 - tick) * 25}%` }} />
            ))}
            {periods.map(([date, { total, members }]) => {
              const dateLabel = periodLabel(date, true)
              return (
                <Tooltip key={date}>
                  <TooltipTrigger asChild>
                    <button type="button" data-accounts={members.map(account => account.id).join(' ')} aria-label={dateLabel} aria-haspopup="dialog"
                      onClick={event => onOpenQueue(dateLabel, members, event.currentTarget)}
                      className="relative w-1/2 max-w-14 rounded-t bg-primary hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      style={{ height: `${total / (step * 4) * 100}%` }} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6} collisionPadding={8} className="grid max-w-64 gap-1">
                    <strong>{dateLabel}</strong>
                    <span>{fmt.list(members.map(account => account.name))}</span>
                    <span>{t('value')} · {fmt.number(total, currency)}</span>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          <dl className="mt-2 grid text-center text-xs text-muted-foreground" style={columns}>
            {periods.map(([date, { total }]) => (
              <div key={date}>
                <dt><time dateTime={date}>{periodLabel(date)}</time></dt>
                <dd className="sr-only">{fmt.number(total, currency)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
