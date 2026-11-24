'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/shared/hooks/use-reduced-motion'

function AnimatedText({ text }: { text: string }) {
  const [visible, setVisible] = useState(0)
  const characters = Array.from(text)
  useEffect(() => {
    let count = 0
    const timer = window.setInterval(() => {
      count += 2
      setVisible(count)
      if (count >= characters.length) window.clearInterval(timer)
    }, 8)
    return () => window.clearInterval(timer)
  }, [characters.length])
  return <>
    <span className="sr-only">{text}</span>
    <span aria-hidden="true" className="grid">
      <span className="invisible col-start-1 row-start-1">{text}</span>
      <span className="col-start-1 row-start-1">{characters.slice(0, visible).join('')}</span>
    </span>
  </>
}

export function TypedText({ text }: { text: string }) {
  return useReducedMotion() ? <>{text}</> : <AnimatedText key={text} text={text} />
}
