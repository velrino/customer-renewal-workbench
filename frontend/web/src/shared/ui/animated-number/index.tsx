'use client'

import { CountUp } from 'countup.js'
import { useLocale } from 'next-intl'
import { useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from '@/shared/hooks/use-reduced-motion'

export function AnimatedNumber({
  value,
  options,
}: {
  value: number
  options?: Intl.NumberFormatOptions
}) {
  const locale = useLocale()
  const formatter = useMemo(
    () => new Intl.NumberFormat(locale, options),
    [locale, options],
  )
  const reduced = useReducedMotion()
  const element = useRef<HTMLSpanElement>(null)
  const previous = useRef(0)
  useEffect(() => {
    if (!element.current || reduced) return
    const counter = new CountUp(element.current, value, {
      duration: 0.75,
      startVal: previous.current,
      formattingFn: formatter.format,
    })
    counter.start()
    return () => {
      previous.current = counter.frameVal
      counter.onDestroy()
    }
  }, [value, formatter, reduced])
  const formatted = formatter.format(value)
  return (
    <>
      <span className="sr-only">{formatted}</span>
      <span key={String(reduced)} aria-hidden="true" ref={element}>
        {formatted}
      </span>
    </>
  )
}
