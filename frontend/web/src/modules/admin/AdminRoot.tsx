'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar'
import { Navigation } from './layout/WorkbenchNavigation'

export function AdminRoot({ children }: { children: React.ReactNode }) {
  const view =
    useSelectedLayoutSegment() === 'account-queue' ? 'accounts' : 'dashboard'
  return (
    <SidebarProvider>
      <Navigation view={view} />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
