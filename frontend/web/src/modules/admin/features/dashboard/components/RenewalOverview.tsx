import type { DashboardSection } from '../useDashboardLoading'
import { Skeleton } from '@/shared/ui/skeleton'
import { MetricSkeleton } from './DashboardSkeleton'
import { useId, useSyncExternalStore } from 'react'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { readStorageValue, storageKey, subscribeToStorage } from '@/shared/storage/local-storage'
import { usePreferenceRecord } from '@/shared/storage/local-storage/preferences/use-preference-record'
import { preferenceKeys } from '@/shared/storage/local-storage/preferences'
import { SortableMetric } from './SortableMetric'
import { Button } from '@/shared/ui/button'
import { RenewalTimeline, type OpenTimelineQueue } from './RenewalTimeline'
import { RelativeDate } from '@/shared/ui/relative-date'
import {
  Banknote,
  CalendarDays,
  Users,
  Target,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { AnimatedNumber } from '@/shared/ui/animated-number'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/shared/ui/card'
import { currency, renewsSoon, type Account } from '@/shared/renewals/accounts'

import {
  attention,
  committed,
  evidenceKey,
  planningCoverage,
  renewalDate,
  today,
  type Changes,
} from '@/shared/renewals/workflow'

const metricsKey = storageKey('widgets', 'dashboard-metrics')
const timelineKey = storageKey('charts', 'renewal-timeline')

export function RenewalOverview({
  isReady,
  demo,
  onOpenQueue,
  onShowUpcoming,
  periodAccounts,
  inspect,
  choose,
  changes,
}: {
  demo: boolean
  isReady: (section: DashboardSection) => boolean
  onOpenQueue: OpenTimelineQueue
  onShowUpcoming: () => void
  periodAccounts: Account[]
  choose: (button: HTMLButtonElement) => void
  changes: Changes
  inspect: (a: Account, opener: HTMLButtonElement) => void
}) {
  const dragId = useId()
  const metricsPrefs = usePreferenceRecord(metricsKey, demo)
  const timeline = usePreferenceRecord(timelineKey, demo)
  const expanded = timeline.prefs.expanded === true
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const referenceDay = today()
  const t = useTranslations('dashboard')
  const resizeLabel = t(expanded ? 'collapseTimeline' : 'expandTimeline')
  const total = periodAccounts.reduce((sum, a) => sum + a.value, 0)
  const allocated = committed(changes)
  const coverage = planningCoverage(changes, periodAccounts)
  const metrics = [
    {
      key: 'tracked',
      note: 'chooseAccount',
      value: periodAccounts.length,
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
      value: periodAccounts.filter(renewsSoon).length,
      icon: CalendarDays,
    },
    {
      key: 'capacity',
      note: 'slots',
      value: allocated.length,
      icon: Target,
    },
  ] as const
  const keys = metrics.map(metric => metric.key)
  const previousOrder = useSyncExternalStore(subscribeToStorage, () => readStorageValue(preferenceKeys.metricOrder), () => null)
  const storedOrder = metricsPrefs.prefs.order ?? (demo ? [] : previousOrder?.split(','))
  const orderedKeys = Array.from(new Set([...(Array.isArray(storedOrder) ? storedOrder : []), ...keys]))
    .filter((key): key is typeof keys[number] => keys.some(valid => valid === key))
  const orderedMetrics = orderedKeys.map(key => metrics.find(metric => metric.key === key)!)
  return (
    <>
      <DndContext id={dragId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        const from = orderedKeys.findIndex(key => key === active.id)
        const to = orderedKeys.findIndex(key => key === over.id)
        if (from < 0 || to < 0) return
        const order = arrayMove(orderedKeys, from, to)
        metricsPrefs.update({ order })
      }}>
        <SortableContext items={orderedKeys} strategy={rectSortingStrategy}>
          <div data-demo-order={demo ? orderedKeys.join(',') : undefined} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orderedMetrics.map(({ key, note, value, icon: Icon }) => !isReady(key) ? <MetricSkeleton key={key} /> : (
              <SortableMetric key={key} id={key} label={t('moveMetric', { name: t(key) })}>
                <CardHeader className="flex items-center justify-between pe-9">
                  <CardTitle className="text-sm font-medium">
                    {key === 'tracked' ? (
                      <button
                        className="after:absolute after:inset-0 after:rounded-xl hover:underline"
                        disabled={!periodAccounts.length}
                        aria-haspopup="dialog"
                        onClick={(event) => choose(event.currentTarget)}
                      >
                        {t(key)}
                      </button>
                    ) : key === 'due' && value > 0 ? (
                      <a
                        className="after:absolute after:inset-0 after:rounded-xl hover:underline"
                        href="#account-queue"
                        onClick={onShowUpcoming}
                      >
                        {t(key)}
                      </a>
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
              </SortableMetric>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className={expanded ? 'lg:col-span-full' : 'lg:col-span-4'}>
          <CardHeader>
            <CardTitle>{t('calendar')}</CardTitle>
            <CardAction className="hidden lg:block">
              <Button type="button" variant="ghost" size="icon" aria-label={resizeLabel} title={resizeLabel}
                aria-controls="renewal-timeline" aria-expanded={expanded} onClick={() => timeline.update({ expanded: !expanded })}>
                {expanded ? <Minimize2 /> : <Maximize2 />}
              </Button>
            </CardAction>
            {periodAccounts.length > 0 && <CardDescription>{t('calendarHint')}</CardDescription>}
          </CardHeader>
          <CardContent id="renewal-timeline">
            {!isReady('timeline') ? <Skeleton className="h-72 w-full" /> : <RenewalTimeline onOpenQueue={onOpenQueue} interval={timeline.prefs.interval} onIntervalChange={interval => timeline.update({ interval })} accounts={periodAccounts} referenceDay={referenceDay} />}
          </CardContent>
        </Card>
        <Card id="review-now" className={expanded ? 'lg:col-span-full' : 'lg:col-span-3'}>
          <CardHeader>
            <CardTitle>{t('attention')}</CardTitle>
            <CardDescription>{t('attentionHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {!isReady('attention') ? <Skeleton className="h-40 w-full" /> : (
              <>
                {periodAccounts.filter((a) => attention(a, changes[a.id]) === 'review')
                  .length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('noReview')}</p>
                )}
                {periodAccounts
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
                          <RelativeDate date={renewalDate(a.days, referenceDay)} referenceDay={referenceDay} /> ·{' '}
                          {t('signals.' + evidenceKey(a, changes[a.id]))}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
