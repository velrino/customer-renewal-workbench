'use client'

import {
  useState,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslations } from 'next-intl'
import { CircleHelp } from 'lucide-react'
import { readStorageValue, subscribeToStorage, writeStorageValue } from '@/shared/storage/local-storage'
import { Button } from '../button'
import { TypedText } from '../typed-text'
import './tour.css'

export type TourStep = { target: string; title: string; explanation: string }

function useTargetRect(target: string) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    const el = document.getElementById(target)
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    const update = () => setRect(el.getBoundingClientRect())
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [target])
  return rect
}

function StepPanel({
  step,
  children,
}: {
  step: TourStep
  children: React.ReactNode
}) {
  const rect = useTargetRect(step.target)
  const sideLeft =
    rect &&
    (rect.right + 338 <= window.innerWidth
      ? rect.right + 14
      : rect.left >= 338
        ? rect.left - 322
        : undefined)
  return (
    <div
      className="tour-step"
      style={
        rect && sideLeft !== undefined
          ? ({
              '--tour-left': sideLeft + 'px',
              '--tour-top':
                Math.min(
                  Math.max(12, rect.top),
                  Math.max(12, window.innerHeight - 240),
                ) + 'px',
            } as React.CSSProperties)
          : undefined
      }
    >
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl border-2 border-primary"
          style={{
            top: rect.top - 3,
            left: rect.left - 3,
            width: rect.width + 6,
            height: rect.height + 6,
            boxShadow: '0 0 0 200vmax rgb(0 0 0 / 0.55)',
          }}
        />
      )}
      <div className="tour-content">{children}</div>
    </div>
  )
}

export function QuickTour({
  steps,
  invitationKey,
  onClose,
}: {
  steps: readonly TourStep[]
  invitationKey?: string
  onClose?: () => void
}) {
  const t = useTranslations('tour')
  const saved = useSyncExternalStore(
    subscribeToStorage,
    () => invitationKey ? readStorageValue(invitationKey) : null,
    () => undefined,
  )
  const [localStep, setLocalStep] = useState<number | null>(invitationKey ? null : 0)
  const savedIndex = steps.findIndex(step => saved === `step:${step.target}`)
  const index = invitationKey ? Math.max(0, savedIndex) : localStep ?? 0
  const ended = saved === 'completed' || saved === 'skipped'
  const checking = Boolean(invitationKey && saved === undefined)
  const openTour = invitationKey
    ? !checking && !ended
    : localStep !== null
  function goToStep(next: number) {
    if (invitationKey) writeStorageValue(invitationKey, `step:${steps[next].target}`)
    else setLocalStep(next)
  }

  function closeTour(choice: 'completed' | 'skipped') {
    if (invitationKey) writeStorageValue(invitationKey, choice)
    else setLocalStep(null)
    onClose?.()
  }
  const nextButton = useRef<HTMLButtonElement>(null)
  const step = steps[index]
  if (!step) return null
  return (
    <Dialog.Root
      open={openTour}
      onOpenChange={(next) => {
        if (next) goToStep(0)
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <CircleHelp />
          {t('start')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" />
        <Dialog.Content
          className="quick-tour pointer-events-none fixed inset-0 z-50"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            nextButton.current?.focus()
          }}
        >
          <Dialog.Title className="sr-only">{t('start')}</Dialog.Title>
          <StepPanel step={step}>
            <span className="tour-panel">
              <span className="block text-xs text-muted-foreground">
                {t('progress', { step: index + 1, total: steps.length })}
              </span>
              <span aria-live="polite" className="block">
                <strong className="block text-base">
                  <TypedText text={step.title} />
                </strong>
                <TypedText text={step.explanation} />
              </span>
              <span className="mt-3 flex items-center gap-1">
                <Button size="sm" variant="ghost" className="mr-auto" onClick={() => closeTour('skipped')}>
                  {t('skip')}
                </Button>
                {index > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToStep(index - 1)}
                  >
                    {t('back')}
                  </Button>
                )}
                <Button
                  ref={nextButton}
                  size="sm"
                  onClick={() => {
                    if (index + 1 === steps.length) closeTour('completed')
                    else goToStep(index + 1)
                  }}
                >
                  {t(index + 1 === steps.length ? 'done' : 'next')}
                </Button>
              </span>
            </span>
          </StepPanel>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
