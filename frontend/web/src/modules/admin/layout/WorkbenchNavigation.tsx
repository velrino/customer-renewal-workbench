'use client'

import { BriefcaseBusiness, LayoutDashboard, List, X } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/shared/ui/button'
import { ThemeDialog } from '@/shared/ui/theme-dialog'
import { Separator } from '@/shared/ui/separator'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/shared/ui/sidebar'

export type DashboardView = 'dashboard' | 'accounts'
const destinations = [
  { id: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'accounts', href: '/dashboard/account-queue', icon: List },
] as const

export function Navigation({ view }: { view: DashboardView }) {
  const t = useTranslations('nav')
  const { setOpenMobile, isMobile } = useSidebar()
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 overflow-hidden px-2 group-data-[collapsible=icon]:p-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BriefcaseBusiness size={17} />
          </span>
          <div className="truncate text-sm group-data-[collapsible=icon]:hidden">
            <strong>{t('brand')}</strong>
            <div className="text-xs">{t('team')}</div>
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label={t('close')}
              onClick={() => setOpenMobile(false)}
            >
              <X />
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t('workspace')}>
          <SidebarGroup>
            <SidebarGroupLabel>{t('workspace')}</SidebarGroupLabel>
            <SidebarMenu>
              {destinations.map(({ id, href, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    tooltip={t(id)}
                    aria-label={t(id)}
                    aria-current={view === id ? 'page' : undefined}
                    isActive={view === id}
                    asChild
                  >
                    <Link href={href} onClick={() => setOpenMobile(false)}>
                      <Icon />
                      <span>{t(id)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}

export function Navbar({ view }: { view: DashboardView }) {
  const t = useTranslations('nav')
  return (
    <header className="flex h-16 items-center gap-4 px-4">
      <SidebarTrigger variant="outline" />
      <Separator orientation="vertical" className="max-h-6" />
      <span className="text-sm font-medium">
        {t(view === 'dashboard' ? 'overview' : 'accounts')}
      </span>
      <ThemeDialog />
    </header>
  )
}
