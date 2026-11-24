'use client'

import { useId } from 'react'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../cn'

type SelectDropdownProps = {
  label: string
  hideLabel?: boolean
  description?: string
  value?: string
  defaultValue?: string
  placeholder?: string
  onValueChange?: (value: string) => void
  items: readonly { value: string; label: string; disabled?: boolean }[]
  autoFocus?: boolean
}

export function SelectDropdown({
  label, hideLabel, description, value, defaultValue, placeholder,
  onValueChange, items, autoFocus,
}: SelectDropdownProps) {
  const id = useId()
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id} className={cn('font-medium', hideLabel && 'sr-only')}>{label}</label>
      {description && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{description}</p>}
      <Select.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
        <Select.Trigger
          id={id}
          autoFocus={autoFocus}
          aria-describedby={description ? `${id}-hint` : undefined}
          className="flex h-9 w-full items-center justify-between gap-3 rounded-md border bg-background px-3 text-start shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon asChild><ChevronDown className="size-4 opacity-60" /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={4} className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            <Select.ScrollUpButton className="flex justify-center"><ChevronUp className="size-4" /></Select.ScrollUpButton>
            <Select.Viewport className="p-1">
              {items.map(item => (
                <Select.Item key={item.value} value={item.value} disabled={item.disabled} className="relative flex items-center rounded-sm py-1.5 ps-2 pe-8 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50">
                  <Select.ItemText>{item.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute end-2"><Check className="size-4" /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="flex justify-center"><ChevronDown className="size-4" /></Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}
