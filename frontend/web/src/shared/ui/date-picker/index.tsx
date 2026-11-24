'use client'

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { Button } from '../button'

type DatePickerProps = Pick<React.ComponentProps<'button'>, 'id' | 'aria-invalid' | 'aria-describedby'> & {
  label: string
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
  min?: Date
  max?: Date
  placeholder?: string
  defaultMonth?: Date
}

export function DatePicker({ label, selected, onSelect, defaultMonth, min, max, placeholder, ...triggerProps }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const fmt = useFormatter()
  const t = useTranslations('datePicker')
  const displayDate = selected && fmt.dateTime(selected, { dateStyle: 'medium', timeZone: 'UTC' })

  function choose(date: Date | undefined) {
    onSelect(date)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button {...triggerProps} type="button" variant="outline" aria-label={displayDate ? `${label}, ${displayDate}` : label}>
          <CalendarDays aria-hidden="true" />
          {displayDate ?? placeholder ?? label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} aria-label={label}
          className="z-50 max-h-[var(--radix-popover-content-available-height)] overflow-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
          <DayPicker mode="single" timeZone="UTC" autoFocus selected={selected}
            disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
            defaultMonth={selected ?? defaultMonth ?? min} onSelect={choose}
            className="[--rdp-accent-color:var(--primary)]! [--rdp-day-width:2.25rem]! [--rdp-day-height:2.25rem]! [--rdp-day_button-width:2.25rem]! [--rdp-day_button-height:2.25rem]!" />
          {selected && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => choose(undefined)}>
              {t('clear')}
            </Button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
