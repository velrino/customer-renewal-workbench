'use client'

import { useEffect } from 'react'
import Typewriter from 'typewriter-effect'
import { useReducedMotion } from '@/shared/hooks/use-reduced-motion'

export function TypedText({
  text,
  onComplete,
}: {
  text: string
  onComplete?: () => void
}) {
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) onComplete?.()
  }, [reduced, onComplete])
  if (reduced) return <>{text}</>
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="grid">
        <span className="invisible col-start-1 row-start-1">{text}</span>
        <span className="col-start-1 row-start-1">
          <Typewriter
            key={text}
            component="span"
            options={{
              delay: 8,
              stringSplitter: (value) => value.match(/[\s\S]{1,2}/gu) ?? [],
              cursor: '',
              skipAddStyles: true,
            }}
            onInit={(writer) => {
              writer.typeString(text)
              if (onComplete) writer.callFunction(onComplete)
              writer.start()
            }}
          />
        </span>
      </span>
    </>
  )
}
