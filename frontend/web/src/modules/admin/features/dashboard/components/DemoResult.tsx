import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { accounts } from '@/shared/renewals/accounts'
import { keepDemoPlan } from '@/shared/renewals/hooks/useRenewalWork'
import { WorkflowError, type Plan } from '@/shared/renewals/workflow'
import { storageKey } from '@/shared/storage/local-storage'
import { usePreferenceRecord } from '@/shared/storage/local-storage/preferences/use-preference-record'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { ResetWorkbenchDialog } from '../../../layout/ResetWorkbenchDialog'
import { toast } from '@/shared/ui/toast'

export function DemoResult({ plan, order, onExit, onReset }: {
  plan: Plan; order: string[]; onExit: () => void; onReset: () => Promise<void>
}) {
  const t = useTranslations('demo')
  const layout = usePreferenceRecord(storageKey('widgets', 'dashboard-metrics'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function keepExample() {
    const ember = accounts.find(account => account.id === 'ember')
    if (!ember || saving) return
    setSaving(true)
    setError(false)
    try {
      await keepDemoPlan(ember, plan)
    } catch (error) {
      if (error instanceof WorkflowError && (error.reason === 'changed' || error.reason === 'full')) {
        toast.message(t('existingHint'))
      } else {
        setError(true)
        setSaving(false)
        return
      }
    }
    layout.update({ order })
    onExit()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onExit() }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('finished')}</DialogTitle>
          <DialogDescription>{t('result')} {t('keepHint')}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert">{t('storeError')}</p>}
        <DialogFooter>
          <ResetWorkbenchDialog onReset={onReset} disabled={saving} />
          <Button variant="outline" disabled={saving} onClick={onExit}>{t('reset')}</Button>
          <Button disabled={saving} onClick={keepExample}>{t('continue')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
