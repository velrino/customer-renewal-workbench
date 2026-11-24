'use client'

import { useState, useSyncExternalStore } from 'react'
import { readStorageValue, subscribeToStorage, writeStorageValue } from '..'

function parseRecord(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Invalid preferences fall back to component defaults.
  }
  return {}
}

export function usePreferenceRecord(key: string, temporary = false) {
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const raw = useSyncExternalStore(subscribeToStorage, () => readStorageValue(key), () => null)
  function update(patch: Record<string, unknown>) {
    if (temporary) {
      setDraft(previous => ({ ...previous, ...patch }))
      return
    }
    const current = parseRecord(readStorageValue(key))
    writeStorageValue(key, JSON.stringify({ ...current, ...patch }))
  }
  return { prefs: temporary ? draft : parseRecord(raw), update }
}
