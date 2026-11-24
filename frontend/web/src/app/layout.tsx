import './globals.css'
import { ScrollToTop } from './ScrollToTop'
import { Providers } from './providers'
import { AdminRoot } from '@/modules/admin/AdminRoot'
import { EnvironmentProvider } from '@/shared/api/environment'
import { routing } from '@/shared/i18n/routing'
import messages from '@/shared/i18n/messages/en.json'

export const metadata = { title: messages.nav.brand }
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang={routing.defaultLocale} suppressHydrationWarning>
      <body>
        <ScrollToTop />
        <Providers>
          <EnvironmentProvider>
            <AdminRoot>{children}</AdminRoot>
          </EnvironmentProvider>
        </Providers>
      </body>
    </html>
  )
}
