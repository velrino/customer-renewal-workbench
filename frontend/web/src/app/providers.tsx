'use client'

import { useEffect } from 'react'
import { initializeTelemetry } from '@/shared/telemetry'
import { preferenceKeys } from '@/shared/storage/local-storage/preferences'

import { NextIntlClientProvider } from 'next-intl'
import { ToastRegion } from '@/shared/ui/toast'
import { ThemeProvider } from 'next-themes'
import { routing } from '@/shared/i18n/routing'
import messages from '@/shared/i18n/messages/en.json'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => { void initializeTelemetry() }, [])

  return (
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      timeZone="UTC"
      messages={messages}
    >
      <ThemeProvider
        storageKey={preferenceKeys.theme}
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <ToastRegion />
      </ThemeProvider>
    </NextIntlClientProvider>
  )
}
