'use client'

import { ArrowLeftRight, BriefcaseBusiness, ExternalLink, LayoutDashboard, Play, UserRound, X } from 'lucide-react'
import { useId } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEnvironment } from '@/shared/api/environment'
import { useTranslations } from 'next-intl'
import { SelectDropdown } from '@/shared/ui/select-dropdown'
import { Button } from '@/shared/ui/button'
import { DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
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

export function Navigation({ openUserMenu }: { openUserMenu: () => void }) {
  const t = useTranslations('nav')
  const { environment } = useEnvironment()
  const isDashboard = usePathname() === '/'
  const { setOpenMobile, isMobile } = useSidebar()
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:p-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground group-data-[collapsible=icon]:hidden">
            <BriefcaseBusiness size={17} />
          </span>
          <div className="flex min-w-0 flex-col items-start">
            <strong className="truncate text-sm group-data-[collapsible=icon]:hidden">{t('brand')}</strong>
            <Button
              type="button"
              size="sm"
              className="h-6 rounded-full bg-slate-700 px-2 text-xs font-semibold text-white hover:bg-slate-800 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:p-0"
              aria-label={t('environmentMenu', { environment: t(environment) })}
              title={t('environmentMenu', { environment: t(environment) })}
              aria-haspopup="dialog"
              onClick={() => {
                if (isMobile) setOpenMobile(false)
                openUserMenu()
              }}
            >
              <span className="uppercase group-data-[collapsible=icon]:hidden">{t(environment)}</span>
              <ArrowLeftRight aria-hidden="true" className="hidden group-data-[collapsible=icon]:block" />
            </Button>
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
                <SidebarMenuButton tooltip={t('dashboard')} aria-label={t('dashboard')} aria-current={isDashboard ? 'page' : undefined} isActive={isDashboard} asChild>
                  <Link href="/" onClick={() => setOpenMobile(false)}>
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

export function Navbar({ title, onReset, onDemo }: { title?: string; onReset?: () => Promise<void>; onDemo?: () => void }) {
  const t = useTranslations('nav')
  const { environment, preferredEnvironment, availability, select, practice } = useEnvironment()
  const menuId = useId()
  const environmentHint = availability === 'available' ? preferredEnvironment : availability

  return (
    <header className="flex h-16 items-center gap-4 px-4">
      <SidebarTrigger variant="outline" />
      <Separator orientation="vertical" className="max-h-6" />
      <span className="text-sm font-medium">
        {title ?? t('overview')}
      </span>
      <span className="text-xs text-muted-foreground" aria-live="polite">{t(practice ? 'practice' : environment)}</span>
      <ThemeDialog />
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full" aria-keyshortcuts="Escape" aria-label={t('userMenu')} title={t('userMenu')}>
          <UserRound aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm" aria-describedby={undefined}>
        <DialogTitle>{t('userMenu')}</DialogTitle>
        <section aria-label={t('environment')}>
          {practice ? <p>{t('practiceHint')}</p> : <SelectDropdown
            label={t('environment')}
            description={t(`environmentHint.${environmentHint}`)}
            value={preferredEnvironment}
            onValueChange={select}
            items={[
              { value: 'local', label: t('local') },
              { value: 'api', label: t('api'), disabled: availability !== 'available' },
            ]}
          />}
        </section>
        <Separator />
        <section aria-labelledby={menuId + '-actions'} className="grid gap-3">
          <h3 id={menuId + '-actions'} className="text-sm font-medium">{t('workbenchActions')}</h3>
          <div className="grid gap-1">
            <p id={menuId + '-demo'} className="text-xs text-muted-foreground">{t('demoHint')}</p>
            <DialogClose asChild>
              {onDemo ? (
                <Button variant="outline" className="justify-start" onClick={onDemo} aria-describedby={menuId + '-demo'}><Play />{t('demo')}</Button>
              ) : (
                <Button asChild variant="outline" className="justify-start"><Link href="/#demo" aria-describedby={menuId + '-demo'}><Play />{t('demo')}</Link></Button>
              )}
            </DialogClose>
          </div>
          {onReset && (
            <div className="grid gap-1">
              <p id={menuId + '-reset'} className="text-xs text-muted-foreground">{t(`resetHint.${environment}`)}</p>
              <ResetWorkbenchDialog onReset={onReset} descriptionId={menuId + '-reset'} />
            </div>
          )}
        </section>
        <Separator />
        <section aria-labelledby={menuId + '-links'} className="grid gap-1">
          <h3 id={menuId + '-links'} className="mb-1 text-sm font-medium">{t('links')}</h3>
          {([
            ['github', 'https://github.com/velrino/customer-renewal-workbench'],
            ['author', 'https://github.com/velrino/'],
          ] as const).map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              aria-describedby={menuId + '-' + label}
              aria-label={t(label) + ' · ' + t('opensNewTab')}
              className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <span>
                <span id={menuId + '-' + label} className="block text-xs text-muted-foreground">{t(`linkHint.${label}`)}</span>
                <span className="block text-sm font-medium">{t(label)}</span>
              </span>
              <ExternalLink aria-hidden="true" className="size-4 text-muted-foreground" />
            </a>
          ))}
        </section>
      </DialogContent>
    </header>
  )
}
