'use client'

import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Button } from '../button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../dialog'

const themeOptions = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor },
] as const

export function ThemeDialog() {
  const t = useTranslations('nav')
  const { theme, setTheme } = useTheme()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label={t('theme')}
          title={t('theme')}
        >
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{t('theme')}</DialogTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {themeOptions.map(({ mode, icon: Icon }) => (
            <Button
              key={mode}
              variant={theme === mode ? 'default' : 'outline'}
              aria-pressed={theme === mode}
              className="relative h-12 justify-start gap-3 md:h-20 md:flex-col md:justify-center"
              onClick={() => setTheme(mode)}
            >
              <Icon />
              {t(mode)}
              {theme === mode && <Check aria-hidden="true" className="absolute right-3 size-4 md:right-2 md:top-2" />}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
