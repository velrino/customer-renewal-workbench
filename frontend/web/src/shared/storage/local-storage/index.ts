const appPrefix = 'renewal-workbench'

export function storageKey(namespace: string, name: string) {
  return [appPrefix, encodeURIComponent(namespace), encodeURIComponent(name)].join(':')
}

const unsaved = new Map<string, string>()

export function readStorageValue(key: string): string | null {
  const fallback = unsaved.get(key)
  if (fallback !== undefined) return fallback
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorageValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    unsaved.delete(key)
  } catch {
    unsaved.set(key, value)
  }
  window.dispatchEvent(new Event('workbench-storage-change'))
}

export function subscribeToStorage(refresh: () => void) {
  window.addEventListener('storage', refresh)
  window.addEventListener('pageshow', refresh)
  window.addEventListener('workbench-storage-change', refresh)
  return () => {
    window.removeEventListener('storage', refresh)
    window.removeEventListener('pageshow', refresh)
    window.removeEventListener('workbench-storage-change', refresh)
  }
}

export function clearWorkbenchPreferences() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(appPrefix + ':')) localStorage.removeItem(key)
    }
  } catch {
    // IndexedDB has already reset. Restricted storage can only clear this tab's preferences.
  }
  unsaved.clear()
  window.dispatchEvent(new Event('workbench-storage-change'))
}
