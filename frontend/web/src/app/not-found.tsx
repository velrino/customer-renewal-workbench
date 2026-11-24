import Link from 'next/link'
import { Navbar } from '@/modules/admin/layout/WorkbenchNavigation'
import messages from '@/shared/i18n/messages/en.json'
import { Button } from '@/shared/ui/button'

export const metadata = { title: `${messages.notFound.title} · ${messages.nav.brand}` }

export default function NotFound() {
  return (
    <>
      <Navbar title={messages.nav.workspace} />
      <main className="grid flex-1 place-items-center px-4 py-8 text-center">
        <div>
          <h1>
            <span className="block text-6xl font-bold tracking-tight sm:text-7xl">404</span>
            <span className="mt-2 block text-xl font-semibold">{messages.notFound.title}</span>
          </h1>
          <Button asChild className="mt-6">
            <Link href="/">{messages.notFound.back}</Link>
          </Button>
        </div>
      </main>
    </>
  )
}
