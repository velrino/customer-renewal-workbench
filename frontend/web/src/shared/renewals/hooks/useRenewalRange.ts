'use client'

import { useSyncExternalStore } from 'react'
import type { DateRange } from 'react-day-picker'
import { readStorageValue, subscribeToStorage, writeStorageValue } from '@/shared/storage/local-storage'
import { preferenceKeys } from '@/shared/storage/local-storage/preferences'

function readRange() {
  return readStorageValue(preferenceKeys.renewalRange)
}

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
  const day = new Date(value)
  if (Number.isFinite(day.getTime()) && day.toISOString().startsWith(value)) return day
}

function setRange(range: DateRange | undefined) {
  const value = range?.from && range.to
    ? [range.from, range.to].map(day => day.toISOString().slice(0, 10)).join('/')
    : ''
  writeStorageValue(preferenceKeys.renewalRange, value)
}

export function useRenewalRange() {
  const raw = useSyncExternalStore(subscribeToStorage, readRange, () => null)
  const parts = raw?.split('/')
  const from = parts?.length === 2 ? parseDay(parts[0]) : undefined
  const to = parts?.length === 2 ? parseDay(parts[1]) : undefined
  const range = from && to && from <= to ? { from, to } : undefined
  return { range, setRange }
}
