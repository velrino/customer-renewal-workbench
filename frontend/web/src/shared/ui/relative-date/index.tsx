import { useFormatter, useLocale } from 'next-intl'

type RelativeDateProps = {
  /** ISO calendar dates (YYYY-MM-DD). */
  date: string
  referenceDay: string
  showExact?: boolean
}

export function RelativeDate({ date, referenceDay, showExact }: RelativeDateProps) {
  const locale = useLocale()
  const fmt = useFormatter()
  // ISO date-only strings share a UTC midnight, even across daylight-saving changes.
  const days = (Date.parse(date) - Date.parse(referenceDay)) / 86_400_000
  const wholeWeeks = days !== 0 && days % 7 === 0
  const relative = new Intl.RelativeTimeFormat(locale, {
    numeric: wholeWeeks ? 'always' : 'auto',
  }).format(wholeWeeks ? days / 7 : days, wholeWeeks ? 'week' : 'day')
  const exact = fmt.dateTime(new Date(date), { dateStyle: 'medium', timeZone: 'UTC' })

  return (
    <time dateTime={date} title={exact} suppressHydrationWarning>
      {showExact ? `${relative} (${exact})` : relative}
    </time>
  )
}
