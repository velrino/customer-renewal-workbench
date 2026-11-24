'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { preferenceKeys } from '@/shared/storage/local-storage/preferences'
import { usePreferenceRecord } from '@/shared/storage/local-storage/preferences/use-preference-record'
import { API } from './api.request'

type Environment = 'local' | 'api'
type Availability = 'checking' | 'available' | 'unavailable'

const EnvironmentContext = createContext<{
  environment: Environment
  availability: Availability
  select: (value: string) => void
} | null>(null)

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const { prefs, update } = usePreferenceRecord(preferenceKeys.environment)
  const [availability, setAvailability] = useState<Availability>('checking')

  useEffect(() => {
    let active: AbortController | undefined

    function offline() {
      active?.abort()
      active = undefined
      setAvailability('unavailable')
    }

    async function check() {
      if (!navigator.onLine) return offline()
      if (active || document.hidden) return
      const controller = new AbortController()
      active = controller
      const timeout = window.setTimeout(() => controller.abort(), 6000)
      try {
        const health = await API.health.read(controller.signal)
        if (active === controller) setAvailability(health.status === 'ok' ? 'available' : 'unavailable')
      } catch {
        if (active === controller) setAvailability('unavailable')
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

  const environment = prefs.selected === 'api' && availability === 'available' ? 'api' : 'local'
  function select(value: string) {
    if (value === 'local' || (value === 'api' && availability === 'available')) {
      update({ selected: value })
    }
  }

  return <EnvironmentContext.Provider value={{ environment, availability, select }}>{children}</EnvironmentContext.Provider>
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext)
  if (!context) throw new Error('EnvironmentProvider is required')
  return context
}
