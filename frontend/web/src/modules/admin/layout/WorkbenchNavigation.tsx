'use client'

import { BriefcaseBusiness, ExternalLink, LayoutDashboard, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { SelectDropdown } from '@/shared/ui/select-dropdown'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { ResetWorkbenchDialog } from './ResetWorkbenchDialog'
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

export function Navigation() {
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
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={t('dashboard')} aria-label={t('dashboard')} aria-current="page" isActive asChild>
                  <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                    <LayoutDashboard />
                    <span>{t('dashboard')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}

export function Navbar({ onReset }: { onReset: () => Promise<void> }) {
  const t = useTranslations('nav')
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
    <header className="flex h-16 items-center gap-4 px-4">
      <SidebarTrigger variant="outline" />
      <Separator orientation="vertical" className="max-h-6" />
      <span className="text-sm font-medium">
        {t('overview')}
      </span>
      <ThemeDialog />
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full" aria-keyshortcuts="Escape" aria-label={t('userMenu')} title={t('userMenu')}>
            <UserRound aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogTitle>{t('userMenu')}</DialogTitle>
          <SelectDropdown
            label={t('environment')}
            description={t('environmentHint')}
            defaultValue="local"
            items={[
              { value: 'local', label: t('local') },
              { value: 'api', label: t('api'), disabled: true },
            ]}
          />
          <Button variant="outline" className="justify-between" asChild>
            <a href="https://github.com/velrino/customer-renewal-workbench" target="_blank" rel="noopener noreferrer">
              {t('github')}
              <span className="sr-only">{t('opensNewTab')}</span>
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
          <ResetWorkbenchDialog onReset={onReset} />
        </DialogContent>
      </Dialog>
    </header>
  )
}
