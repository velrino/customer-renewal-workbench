'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Dashboard } from '@/modules/admin/features/dashboard/Dashboard'

function AccountQueue() {
  const params = useSearchParams()
  return (
    <Dashboard view="accounts" soonOnly={params.get('renewal') === '30d'} />
  )
}

export default function Page() {
  return (
    <Suspense>
      <AccountQueue />
    </Suspense>
  )
}
