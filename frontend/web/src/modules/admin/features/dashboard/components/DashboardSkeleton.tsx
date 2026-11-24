import { Card, CardContent } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

export function MetricSkeleton() {
  return (
    <Card aria-busy="true">
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </CardContent>
    </Card>
  )
}

export function QueueSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <Skeleton className="h-9 w-full max-w-sm" />
      {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-10 w-full" />)}
    </div>
  )
}
