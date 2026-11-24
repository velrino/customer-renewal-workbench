'use client'

import {
  useState,
  useLayoutEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { OnboardingItem } from 'reactjs-onboarding'
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
      <OnboardingItem
        elementCoOrdinate={rect && rect.width && rect.height ? {
          l: rect.left, t: rect.top, w: rect.width, h: rect.height,
        } : undefined}
        message={children}
      />
    </div>
  )
}

export function QuickTour({
  steps,
  invitationKey,
  invitationBackground,
  autoStart = false,
  onClose,
}: {
  steps: readonly TourStep[]
  invitationKey?: string
  autoStart?: boolean
  onClose?: () => void
  invitationBackground?: React.ReactNode
}) {
  const t = useTranslations('tour')
  const saved = useSyncExternalStore(
    subscribeToStorage,
    () => invitationKey ? readStorageValue(invitationKey) : null,
    () => undefined,
  )
  const [localStep, setLocalStep] = useState<number | null>(autoStart && !invitationKey ? 0 : null)
  const savedIndex = steps.findIndex(step => saved === `step:${step.target}`)
  const index = invitationKey ? Math.max(0, savedIndex) : localStep ?? 0
  const ended = saved === 'completed' || saved === 'skipped'
  const checking = Boolean(invitationKey && saved === undefined)
  const openTour = invitationKey
    ? !checking && !ended && (autoStart || savedIndex >= 0)
    : localStep !== null
  const invite = Boolean(invitationKey && !checking && !ended && !openTour)
  const [textReady, setTextReady] = useState(false)
  const finishTyping = useCallback(() => setTextReady(true), [])

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
      open={invite || openTour}
      onOpenChange={(next) => {
        if (next) goToStep(0)
      }}
    >
      {(checking || invite) && invitationBackground}
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <CircleHelp />
          {t('start')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className={
            invite
              ? 'fixed inset-0 z-50 bg-black/50'
              : 'fixed inset-0 z-50'
          }
        />
        {invite ? (
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 grid w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-background px-4 py-6 shadow-lg sm:px-6"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onCloseAutoFocus={(e) => {
              if (nextButton.current) e.preventDefault()
            }}
          >
            <Dialog.Title className="text-lg font-semibold">
              {t('inviteTitle')}
            </Dialog.Title>
            <Dialog.Description asChild>
              <div className="text-sm text-muted-foreground">
                <TypedText text={t('inviteBody')} onComplete={finishTyping} />
              </div>
            </Dialog.Description>
            <div className={`flex items-center justify-between gap-2 ${textReady ? '' : 'invisible'}`}>
              <Button variant="outline" disabled={!textReady} onClick={() => closeTour('skipped')}>
                {t('never')}
              </Button>
              <Button disabled={!textReady} onClick={() => goToStep(0)}>
                {t('startInvite')}
              </Button>
            </div>
          </Dialog.Content>
        ) : (
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
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
