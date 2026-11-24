'use client'

import { storageKey } from '@/shared/storage/local-storage'
import { usePreferenceRecord } from '@/shared/storage/local-storage/preferences/use-preference-record'
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar'
import { Navigation } from './layout/WorkbenchNavigation'

const sidebarKey = storageKey('layout', 'admin-sidebar')

export function AdminRoot({ children }: { children: React.ReactNode }) {
  const { prefs, update } = usePreferenceRecord(sidebarKey)
  return (
    <SidebarProvider open={prefs.open !== false} onOpenChange={open => update({ open })}>
      <Navigation />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
