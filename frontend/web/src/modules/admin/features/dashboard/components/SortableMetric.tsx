import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Card } from '@/shared/ui/card'

export function SortableMetric({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10' : undefined}>
      <Card id={'metric-' + id} className="relative h-full gap-2">
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
          title={label} aria-label={label}
          className="absolute end-1 top-5 z-10 grid size-7 touch-none cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-ring active:cursor-grabbing">
          <GripVertical className="size-4" aria-hidden />
        </button>
        {children}
      </Card>
    </div>
  )
}
