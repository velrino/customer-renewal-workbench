import { EnvironmentProvider } from '@/shared/api/environment'
import { AdminRoot } from '@/modules/admin/AdminRoot'
import { Dashboard } from '@/modules/admin/features/dashboard/Dashboard'

export default function HomePage() {
  return (
    <EnvironmentProvider>
      <AdminRoot>
        <Dashboard />
      </AdminRoot>
    </EnvironmentProvider>
  )
}
