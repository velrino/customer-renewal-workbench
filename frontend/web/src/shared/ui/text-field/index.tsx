'use client'

import { useId, type ComponentProps } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../cn'

type TextFieldProps = Pick<ComponentProps<'input'>,
  'id' | 'name' | 'placeholder' | 'required' | 'disabled' | 'autoFocus' | 'autoComplete' | 'spellCheck' | 'autoCorrect' |
  'aria-invalid' | 'aria-describedby' | 'className'
> & {
  type?: 'text' | 'search' | 'textarea'
  value: string
  onValueChange: (value: string) => void
  maxLength: number
}

export function TextField({
  type = 'text', value, onValueChange, maxLength, className,
  'aria-describedby': description, ...props
}: TextFieldProps) {
  const countId = useId()
  const t = useTranslations('textField')
  const multiline = type === 'textarea'
  const count = Array.from(value).length
  function change(next: string) {
    onValueChange(Array.from(next).slice(0, maxLength).join(''))
  }
  const control = {
    ...props, value,
    'aria-describedby': [description, countId].filter(Boolean).join(' '),
    className: cn(
      'block w-full rounded-md border bg-background px-3 py-2 text-sm',
      multiline ? 'min-h-20 resize-y pb-6' : 'h-9 pe-16',
      className,
    ),
  }

  return (
    <span className="relative block">
      {multiline ? (
        <textarea {...control} onChange={event => change(event.target.value)} />
      ) : (
        <input {...control} type={type} onChange={event => change(event.target.value)} />
      )}
      <span aria-hidden="true" className={cn(
        'pointer-events-none absolute bottom-1 end-2 text-[10px] leading-none tabular-nums text-muted-foreground',
        multiline && 'end-4',
      )}>
        {count}/{maxLength}
      </span>
      <span hidden id={countId}>{t('count', { current: count, total: maxLength })}</span>
    </span>
  )
}
