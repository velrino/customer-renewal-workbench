import { AdminRoot } from '@/modules/admin/AdminRoot'
import { Dashboard } from '@/modules/admin/features/dashboard/Dashboard'

export default function HomePage() {
  return (
    <AdminRoot>
      <Dashboard />
    </AdminRoot>
  )
}
