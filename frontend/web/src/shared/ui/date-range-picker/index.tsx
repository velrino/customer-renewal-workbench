'use client'

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { today } from '@/shared/renewals/workflow'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { Button } from '../button'

export function DateRangePicker({ id, label, value, onChange, fullRange }: {
  id?: string
  label: string
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  fullRange: { from: Date; to: Date }
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const mobile = useIsMobile()
  const fmt = useFormatter()
  const t = useTranslations('datePicker')
  function apply(range: DateRange | undefined) {
    onChange(range)
    setOpen(false)
  }
  function format(date: Date) {
    return fmt.dateTime(date, { dateStyle: 'medium', timeZone: 'UTC' })
  }
  const start = format(value?.from ?? fullRange.from)
  const end = format(value?.to ?? value?.from ?? fullRange.to)

  return (
    <Popover.Root open={open} onOpenChange={next => {
      if (next) setDraft(value ?? fullRange)
      setOpen(next)
    }}>
      <Popover.Trigger asChild>
        <Button id={id} type="button" variant="outline" aria-label={`${label}, ${start} – ${end}`}>
          <CalendarDays aria-hidden />{start} <span aria-hidden="true">→</span> {end}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} collisionPadding={8} aria-label={label}
          className="z-50 max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-1rem)] overflow-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
          <DayPicker mode="range" required resetOnSelect autoFocus timeZone="UTC" today={new Date(today())}
            numberOfMonths={mobile ? 1 : 2} defaultMonth={value?.from ?? fullRange.from}
            selected={draft} onSelect={setDraft}
            className="[--rdp-accent-color:var(--primary)]! [--rdp-day-width:2.25rem]! [--rdp-day-height:2.25rem]! [--rdp-day_button-width:2.25rem]! [--rdp-day_button-height:2.25rem]!" />
          <div className="mt-3 flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => apply(undefined)}>{t('clearRange')}</Button>
            <Button type="button" size="sm" disabled={!draft?.from}
              onClick={() => draft?.from && apply({ from: draft.from, to: draft.to ?? draft.from })}>{t('applyRange')}</Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
