'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function ScrollToTop() {
  const pathname = usePathname()
  const firstVisit = useRef(true)

  useLayoutEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => { history.scrollRestoration = previous }
  }, [])

  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const reloading = firstVisit.current && navigation?.type === 'reload'
    firstVisit.current = false
    if (location.hash && !reloading) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
