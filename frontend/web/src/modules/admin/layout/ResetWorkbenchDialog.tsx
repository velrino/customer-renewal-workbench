import { ApiError } from '@/shared/api/api.resources'
import { useEnvironment, useHoldEnvironment } from '@/shared/api/environment'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { toast } from '@/shared/ui/toast'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'

const resetColor = 'bg-[#9e0812] text-white hover:bg-[#87070f]'

export function ResetWorkbenchDialog({ onReset, disabled, descriptionId }: {
  onReset: () => Promise<void>
  disabled?: boolean
  descriptionId?: string
}) {
  const t = useTranslations('nav')
  const limit = useTranslations('rateLimit')
  const { environment } = useEnvironment()
  const resetLabel = t('reset', { environment: t(environment) })
  const cancel = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  useHoldEnvironment(open)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      await onReset()
      setOpen(false)
    } catch (error) {
      setOpen(false)
      toast.error(t(error instanceof ApiError && error.reason === 'rateLimited' ? 'resetRateLimited' : 'resetError'), {
        description: error instanceof ApiError && error.retryAfterSeconds ? limit('retryAfter', { seconds: error.retryAfterSeconds }) : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      if (!busy) setOpen(next)
    }}>
      <DialogTrigger asChild>
        <Button disabled={disabled} aria-describedby={descriptionId} className={resetColor + ' justify-between'}>{resetLabel}<RotateCcw aria-hidden /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}
        onOpenAutoFocus={event => { event.preventDefault(); cancel.current?.focus() }}>
        <DialogTitle>{t('resetTitle')}</DialogTitle>
        <DialogDescription>{t(environment === 'api' ? 'resetSharedDescription' : 'resetDescription')}</DialogDescription>
        <DialogFooter>
          <Button ref={cancel} variant="outline" disabled={busy} onClick={() => setOpen(false)}>{t('resetCancel')}</Button>
          <Button className={resetColor} disabled={busy} onClick={confirm}>{busy ? t('resetPending') : resetLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
