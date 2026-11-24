'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/shared/ui/dialog'
import { storageKey } from '@/shared/storage/local-storage'
import { usePreferenceRecord } from '@/shared/storage/local-storage/preferences/use-preference-record'
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar'
import { Navigation } from './layout/WorkbenchNavigation'

const sidebarKey = storageKey('layout', 'admin-sidebar')

export function AdminRoot({ children }: { children: React.ReactNode }) {
  const { prefs, update } = usePreferenceRecord(sidebarKey)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.repeat || event.isComposing || event.defaultPrevented) return
      // Check before an open overlay handles this same key and unmounts.
      if (document.querySelector('[role="dialog"]:not([data-state="closed"]), [role="alertdialog"], [role="listbox"]:not([data-state="closed"]), [aria-roledescription="sortable"][aria-pressed="true"]')) return
      event.preventDefault()
      setMenuOpen(true)
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [])

  return (
    <SidebarProvider open={prefs.open !== false} onOpenChange={open => update({ open })}>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <Navigation openUserMenu={() => setMenuOpen(true)} />
        <SidebarInset className="min-w-0">{children}</SidebarInset>
      </Dialog>
    </SidebarProvider>
  )
}
