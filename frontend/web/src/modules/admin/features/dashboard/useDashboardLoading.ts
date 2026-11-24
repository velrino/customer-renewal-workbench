import { useEffect, useState } from 'react'

const sections = ['tracked', 'portfolio', 'due', 'capacity', 'timeline', 'attention', 'queue'] as const
export type DashboardSection = (typeof sections)[number]

export function useDashboardLoading(dataReady: boolean) {
  const [elapsed, setElapsed] = useState<ReadonlySet<DashboardSection>>(() => new Set())
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const timers = sections.map(section => window.setTimeout(() => {
      setElapsed(previous => new Set(previous).add(section))
    }, 500 + Math.floor(Math.random() * 501)))
    return () => timers.forEach(window.clearTimeout)
  }, [attempt])

  function restart() {
    setElapsed(new Set())
    setAttempt(previous => previous + 1)
  }

  function isReady(section: DashboardSection) {
    const needsSavedWork = section === 'due' || section === 'capacity' || section === 'attention' || section === 'queue'
    return elapsed.has(section) && (!needsSavedWork || dataReady)
  }

  return { isReady, complete: dataReady && elapsed.size === sections.length, restart }
}
