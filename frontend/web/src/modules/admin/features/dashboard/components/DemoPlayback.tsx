import { useEffect, useEffectEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { MousePointer2 } from 'lucide-react'
import { renewalDate } from '@/shared/renewals/workflow'
import { Button } from '@/shared/ui/button'
import { toast } from '@/shared/ui/toast'

type Caption = 'move' | 'timeline' | 'queue' | 'overview' | 'plan' | 'owner' | 'date' | 'save' | 'actions' | 'complete'

export function DemoPlayback({ onStop, onFinish }: { onStop: () => void; onFinish: (order: string[]) => void }) {
  const t = useTranslations('demo')
  const [caption, setCaption] = useState<Caption>('move')
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const finish = useEffectEvent(onFinish)
  const stop = useEffectEvent(onStop)
  const failed = useEffectEvent(() => {
    toast.error(t('error'))
    onStop()
  })

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    async function wait(ms: number) {
      await new Promise(resolve => setTimeout(resolve, ms))
      signal.throwIfAborted()
    }
    async function find(selector: string) {
      for (let attempt = 0; attempt < 70; attempt++) {
        signal.throwIfAborted()
        const el = document.querySelector<HTMLElement>(selector)
        if (el?.getClientRects().length && !el.matches(':disabled')) return el
        await wait(60)
      }
      throw new Error('Missing demo control: ' + selector)
    }
    function center(el: HTMLElement) {
      const rect = el.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    async function visit(selector: string, text: Caption) {
      const el = await find(selector)
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      setCaption(text)
      setPoint(center(el))
      await wait(1150)
      return el
    }
    async function click(selector: string, text: Caption) {
      const el = await visit(selector, text)
      el.focus({ preventScroll: true })
      el.click()
    }
    function pointer(target: EventTarget, type: string, x: number, y: number) {
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
      }))
    }
    async function swapCards() {
      const grip = await visit('#metric-tracked button[aria-roledescription="sortable"]', 'move')
      const destination = await find('#metric-portfolio')
      const card = await find('#metric-tracked')
      const start = center(grip)
      const from = center(card)
      const to = center(destination)
      pointer(grip, 'pointerdown', start.x, start.y)
      try {
        pointer(document, 'pointermove', start.x + 8, start.y)
        await wait(80)
        for (let frame = 1; frame <= 12; frame++) {
          const x = start.x + (to.x - from.x) * frame / 12
          const y = start.y + (to.y - from.y) * frame / 12
          pointer(document, 'pointermove', x, y)
          setPoint({ x, y })
          await wait(reduced ? 8 : 50)
        }
        pointer(document, 'pointerup', start.x + to.x - from.x, start.y + to.y - from.y)
      } finally {
        if (signal.aborted) pointer(document, 'pointercancel', start.x, start.y)
      }
      const grid = await find('[data-demo-order^="portfolio,tracked"]')
      await wait(550)
      return grid.dataset.demoOrder!.split(',')
    }
    async function play() {
      await wait(350) // Let the user menu close before directing focus to the board.
      const order = await swapCards()
      await click('#renewal-timeline button[data-accounts~="ember"]', 'timeline')
      await click('[role="dialog"] [data-account="ember"]', 'queue')
      await visit('[data-demo-tab="overview"]', 'overview')
      await click('[data-demo-tab="plan"]', 'plan')
      await click('[data-demo="plan"]', 'plan')
      const owner = await visit('[data-demo="editor"] input', 'owner') as HTMLInputElement
      owner.focus()
      for (const letter of 'Alex Morgan') {
        owner.setRangeText(letter, owner.value.length, owner.value.length, 'end')
        owner.dispatchEvent(new Event('input', { bubbles: true }))
        await wait(65)
      }
      await click('[data-demo="editor"] button[aria-haspopup="dialog"]', 'date')
      const day = '[data-day="' + renewalDate(2) + '"]:not([data-outside]) button'
      if (!document.querySelector(day)) {
        await click('.rdp-button_next', 'date')
      }
      await click(day, 'date')
      await click('[data-demo="editor"] button[type="submit"]', 'save')
      await find('[data-demo-account-status="active"]')
      await click('[data-demo-tab="owner"]', 'actions')
      await click('[data-demo="complete"]', 'complete')
      await find('[data-demo-account-status="completed"]')
      await wait(950)
      finish(order)
    }

    function guard(event: Event) {
      if (!event.isTrusted) return
      if (event instanceof KeyboardEvent && (event.metaKey || event.ctrlKey || event.altKey)) return
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        stop()
      } else if (!(event.target instanceof Element && event.target.closest('[data-demo-stop]'))) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    const events = ['keydown', 'pointerdown', 'click'] as const
    for (const event of events) window.addEventListener(event, guard, true)
    play().catch(() => { if (!signal.aborted) failed() })
    return () => {
      controller.abort()
      for (const event of events) window.removeEventListener(event, guard, true)
    }
  }, [])

  return createPortal(
    <>
      {point && <MousePointer2 aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[90] size-7 fill-primary text-background drop-shadow motion-safe:transition-transform motion-safe:duration-300"
        style={{ transform: `translate(${point.x}px, ${point.y}px)` }} />}
      <div className="pointer-events-auto fixed inset-x-3 bottom-3 z-[90] mx-auto flex max-w-lg items-center gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg">
        <p role="status" className="flex-1 text-sm">{t(caption)}</p>
        <Button data-demo-stop aria-keyshortcuts="Escape" size="sm" variant="outline" onClick={onStop}>{t('stop')}</Button>
      </div>
    </>, document.body)
}
