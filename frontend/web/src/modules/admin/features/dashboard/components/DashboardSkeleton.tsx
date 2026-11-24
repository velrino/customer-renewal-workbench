export function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-40 flex overflow-hidden bg-background">
      <div className="hidden w-56 shrink-0 space-y-4 border-r bg-sidebar p-5 md:block">
        <div className="mb-9 h-8 w-32 rounded bg-muted" />
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-5 w-32 rounded bg-muted" />
      </div>
      <div className="flex-1 space-y-5 p-5">
        <div className="mb-8 h-8 w-24 rounded bg-muted" />
        <div className="h-7 w-44 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-60 rounded-xl bg-muted" />
        <div className="h-32 rounded-xl bg-muted" />
      </div>
    </div>
  )
}
