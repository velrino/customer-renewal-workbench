import { useEffect, useState } from 'react'
import type { Changes } from '../workflow'

type BoardSnapshot = {
  status: 'checking' | 'available' | 'unavailable'
  changes: Changes
}

const initial: BoardSnapshot = { status: 'checking', changes: {} }

export function useSharedBoard(enabled: boolean) {
  const [board, setBoard] = useState(initial)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setBoard(initial)
      return
    }
    let active = true
    let unsubscribe: (() => void) | undefined
    let retryTimer: number | undefined

    function unavailable() {
      setBoard(previous => ({ ...previous, status: 'unavailable' }))
    }

    function failed() {
      if (!active) return
      unavailable()
      // Firestore reconnects cached listeners itself. A terminal error ends the listener.
      retryTimer = window.setTimeout(() => setAttempt(previous => previous + 1), 60_000)
    }

    import('../workflow/shared-board').then(({ subscribeBoard }) => {
      if (!active) return
      unsubscribe = subscribeBoard((changes, cached) => {
        if (!active) return
        if (cached) unavailable()
        else setBoard({ changes, status: 'available' })
      }, failed)
    }).catch(failed)

    return () => {
      active = false
      window.clearTimeout(retryTimer)
      unsubscribe?.()
    }
  }, [enabled, attempt])

  async function retryRead() {
    setAttempt(previous => previous + 1)
  }

  return { ...board, retryRead }
}
