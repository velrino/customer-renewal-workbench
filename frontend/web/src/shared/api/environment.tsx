'use client'

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { preferenceKeys } from '@/shared/storage/local-storage/preferences'
import { usePreferenceRecord } from '@/shared/storage/local-storage/preferences/use-preference-record'
import { useSharedBoard } from '@/shared/renewals/hooks/useSharedBoard'
import { API } from './api.request'

import { useTranslations } from 'next-intl'
import { toast } from '@/shared/ui/toast'

type Environment = 'local' | 'api'
type Availability = 'checking' | 'available' | 'unavailable'

const EnvironmentContext = createContext<{
  environment: Environment
  preferredEnvironment: Environment
  practice: boolean
  setPractice: (value: boolean) => void
  availability: Availability
  board: ReturnType<typeof useSharedBoard>
  setHeldEnvironment: (value: Environment | null) => void
  select: (value: string) => void
} | null>(null)

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const { prefs, update } = usePreferenceRecord(preferenceKeys.environment)
  const [heldEnvironment, setHeldEnvironment] = useState<Environment | null>(null)
  const [practice, setPractice] = useState(false)
  const t = useTranslations('nav')
  const [health, setHealth] = useState<Availability>('checking')

  useEffect(() => {
    let active: AbortController | undefined

    function offline() {
      active?.abort()
      active = undefined
      setHealth('unavailable')
    }

    async function check() {
      if (!navigator.onLine) return offline()
      if (active || document.hidden) return
      const controller = new AbortController()
      active = controller
      const timeout = window.setTimeout(() => controller.abort(), 6000)
      try {
        await API.health.read(controller.signal)
        if (active === controller) setHealth('available')
      } catch {
        if (active === controller) setHealth('unavailable')
      } finally {
        clearTimeout(timeout)
        if (active === controller) active = undefined
      }
    }

    const initial = window.setTimeout(check, 0)
    const interval = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    window.addEventListener('offline', offline)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
      active?.abort()
      active = undefined
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
      window.removeEventListener('offline', offline)
    }
  }, [])

  const preferredEnvironment = prefs.selected === 'api' ? 'api' : 'local'
  const needsBoard = preferredEnvironment === 'api' || heldEnvironment === 'api'
  const board = useSharedBoard(heldEnvironment === 'api' || (preferredEnvironment === 'api' && health === 'available'))
  const availability = needsBoard && health === 'available' ? board.status : health
  const environment = practice ? 'local' : heldEnvironment ?? (availability === 'available' ? preferredEnvironment : 'local')
  const previousDestination = useRef<Environment | null>(null)
  useEffect(() => {
    if (preferredEnvironment !== 'api' || practice) {
      previousDestination.current = null
      return
    }
    if (availability === 'checking') return
    const previous = previousDestination.current
    previousDestination.current = environment
    if (previous !== environment && (previous !== null || environment === 'local')) {
      toast.message(t(environment === 'api' ? 'sharedRestored' : 'usingFallback'), { id: 'workbench-environment' })
    }
  }, [availability, environment, practice, preferredEnvironment, t])
  function select(value: string) {
    if (value === 'local' || (value === 'api' && availability === 'available')) {
      update({ selected: value })
    }
  }

  return <EnvironmentContext.Provider value={{ environment, preferredEnvironment, availability, board, select, setHeldEnvironment, practice, setPractice }}>{children}</EnvironmentContext.Provider>
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext)
  if (!context) throw new Error('EnvironmentProvider is required')
  return context
}

// Keep an open editor or reset confirmation attached to its original data store.
export function useHoldEnvironment(open: boolean) {
  const { environment, setHeldEnvironment } = useEnvironment()
  useLayoutEffect(() => {
    if (!open) return
    setHeldEnvironment(environment)
    return () => setHeldEnvironment(null)
  }, [open, environment, setHeldEnvironment])
}
