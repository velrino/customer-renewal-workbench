'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '../button'

export function MultiSelect<T extends string>({ label, allLabel, summary, options, selected, onChange }: {
  label: string
  allLabel: string
  summary: string
  options: readonly { value: T; label: string }[]
  selected: readonly T[]
  onChange: (next: T[]) => void
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline" aria-label={`${label}, ${summary}`}>
          {summary}<ChevronDown aria-hidden className="size-4 opacity-60" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} aria-label={label}
          className="z-50 grid min-w-48 gap-1 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md">
          <button type="button" aria-pressed={!selected.length} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-accent"
            onClick={() => onChange([])}>
            {allLabel}{!selected.length && <Check aria-hidden className="size-4" />}
          </button>
          {options.map(option => (
            <label key={option.value} className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
              {option.label}
              <input type="checkbox" className="peer sr-only" checked={selected.includes(option.value)}
                onChange={e => onChange(e.target.checked
                  ? [...selected, option.value] : selected.filter(value => value !== option.value))} />
              <Check aria-hidden className="invisible size-4 peer-checked:visible" />
            </label>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
