import { RelativeDate } from '@/shared/ui/relative-date'
import { useId, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from '@/shared/ui/toast'
import { SelectDropdown } from '@/shared/ui/select-dropdown'
import { TextField } from '@/shared/ui/text-field'
import { DatePicker } from '@/shared/ui/date-picker'
import { Button } from '@/shared/ui/button'
import type { Account } from '@/shared/renewals/accounts'
import {
  actions,
  attention,
  evidenceKey,
  renewalDate,
  today,
  suggestedAction,
  WorkflowError,
  type AccountWork,
  type Action,
  type Command,
  type Failure,
} from '@/shared/renewals/workflow'

type Editor = {
  mode: 'plan' | 'information'
  revision: number
  action: Action
  owner: string
  followUp: string
  question: string
}

export function AccountDecision({
  account,
  work,
  save,
  ready,
  readError,
  retry,
  used,
}: {
  account: Account
  work?: AccountWork
  ready: boolean
  readError: boolean
  retry: () => Promise<void>
  used: number
  save: (account: Account, revision: number, command: Command) => Promise<void>
}) {
  const t = useTranslations('dashboard')
  const fmt = useFormatter()
  const ownerId = useId()
  const questionId = useId()
  const followUpId = useId()
  const [draft, setDraft] = useState<Editor | null>(null)
  const [error, setError] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const plan = work?.plan
  const referenceDay = today()
  const renewal = renewalDate(account.days, referenceDay)
  const status = attention(account, work)
  function edit(mode: Editor['mode']) {
    const activePlan = plan?.status === 'active' ? plan : undefined
    setEditing(true)
    setError(null)
    if (draft) {
      setDraft({ ...draft, mode })
      return
    }
    setDraft({
      mode,
      revision: work?.revision ?? 0,
      owner: activePlan?.owner ?? '',
      followUp: activePlan?.followUp ?? '',
      action: activePlan?.action ?? suggestedAction(account, work),
      question: work?.information ?? '',
    })
  }
  async function submit(command: Command, revision: number) {
    setBusy(true)
    setError(null)
    try {
      await save(account, revision, command)
      setDraft(null)
      setEditing(false)
      toast.success(t('confirmed.' + command.type))
    } catch (e) {
      const reason = e instanceof WorkflowError ? e.reason : 'storage'
      setError(reason)
      toast.error(t('errors.' + reason), { id: 'account-decision-error' })
      const invalidField = { ownerRequired: ownerId, questionRequired: questionId, invalidDate: followUpId }
      if (reason === 'ownerRequired' || reason === 'questionRequired' || reason === 'invalidDate') {
        document.getElementById(invalidField[reason])?.focus()
      }
    } finally {
      setBusy(false)
    }
  }
  function dateLabel(value: string) {
    return fmt.dateTime(new Date(value + 'T00:00:00Z'), { dateStyle: 'medium', timeZone: 'UTC' })
  }
  return (
    <div className="space-y-4 text-sm">
      <h3 aria-live="polite" className="font-semibold">
        {t(editing ? (draft?.mode === 'information' ? 'ask' : 'planDetails') : 'evidenceReview')}
      </h3>
      {!editing && (
        <>
          <section className="rounded-md bg-muted p-3">
            <strong>{t('states.' + status)}</strong>
            <h3 className="mt-2 font-semibold">{t('hypothesis')}</h3>
            <p>{t('hypotheses.' + evidenceKey(account, work))}</p>
          </section>
          {plan && (
            <section className="space-y-1 rounded-md border p-3">
              <h3 className="font-semibold">
                {t(plan.status === 'active' ? 'agreedPlan' : 'completedPlan')}
              </h3>
              <p>
                {t('actions.' + plan.action)} · {plan.owner} ·{' '}
                <RelativeDate date={plan.followUp} referenceDay={referenceDay} showExact />
              </p>
              <p className="text-muted-foreground">
                {t('basis')} · {t('signals.' + plan.evidence)}
              </p>
            </section>
          )}
          {work?.information && (
            <p>
              <strong>{t('infoTitle')}</strong> · {work.information}
            </p>
          )}
          <p className="text-muted-foreground">
            {t('used', { count: used })} ·{' '}
            {t('sampleDate', { date: dateLabel(referenceDay) })}
          </p>
        </>
      )}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || !ready}
            onClick={() => edit('information')}
          >
            {t('ask')}
          </Button>
          <Button className="ms-auto" disabled={busy || !ready} onClick={() => edit('plan')}>
            {t(plan?.status === 'active' ? 'editPlan' : 'newPlan')}
          </Button>
        </div>
      )}
      {editing && draft && (
        <form
          noValidate
          className="space-y-3 rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit(
              draft.mode === 'plan'
                ? {
                    type: 'plan',
                    action: draft.action,
                    owner: draft.owner,
                    followUp: draft.followUp,
                  }
                : { type: 'information', question: draft.question },
              draft.revision,
            )
          }}
        >
          {draft.mode === 'plan' && (
            <>
              <SelectDropdown
                label={t('action')}
                autoFocus
                value={draft.action}
                onValueChange={action => setDraft({ ...draft, action: action as Action })}
                items={actions.map(value => ({ value, label: t('actions.' + value) }))}
              />
              <div>
                <label htmlFor={ownerId}>{t('owner')}</label>
                <TextField
                  id={ownerId}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1"
                  required
                  maxLength={80}
                  value={draft.owner}
                  aria-invalid={error === 'ownerRequired'}

                  onValueChange={owner =>
                    setDraft({ ...draft, owner })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={followUpId}>{t('followUp')}</label>
                <DatePicker
                  id={followUpId}
                  label={t('followUp')}
                  placeholder={t('selectDate')}
                  selected={draft.followUp ? new Date(draft.followUp) : undefined}
                  min={new Date(referenceDay)}
                  max={new Date(renewal)}
                  aria-invalid={error === 'invalidDate'}

                  onSelect={date => setDraft({ ...draft, followUp: date?.toISOString().slice(0, 10) ?? '' })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('dateRange', {
                  start: dateLabel(referenceDay),
                  end: dateLabel(renewal),
                })}
              </p>
            </>
          )}
          {draft.mode === 'information' && (
            <div>
              <label htmlFor={questionId}>{t('question')}</label>
              <TextField
                id={questionId}
                type="textarea"
                autoFocus
                className="mt-1"
                required
                maxLength={400}
                value={draft.question}
                aria-invalid={error === 'questionRequired'}

                onValueChange={question =>
                  setDraft({ ...draft, question })
                }
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => {
              setError(null)
              setEditing(false)
            }}>
              {t('decisionBack')}
            </Button>
            <Button type="submit" disabled={busy || !ready}>
              {t(draft.mode === 'information' ? 'saveRequest' : 'savePlan')}
            </Button>
          </div>
        </form>
      )}
      {!editing &&
        ((account.critical && !work?.issueResolved) ||
          plan?.status === 'active') && (
          <section className="space-y-2 border-t pt-3">
            <h3 className="font-semibold">{t('simulation')}</h3>
            <p className="text-muted-foreground">{t('simulationNote')}</p>
            <div className="flex flex-wrap gap-2">
              {account.critical && !work?.issueResolved && (
                <Button
                  disabled={busy || !ready}
                  variant="outline"
                  onClick={() =>
                    void submit({ type: 'resolve' }, work?.revision ?? 0)
                  }
                >
                  {t('resolve')}
                </Button>
              )}
              {plan?.status === 'active' && (
                <Button
                  disabled={busy || !ready}
                  variant="outline"
                  onClick={() =>
                    void submit({ type: 'complete' }, work!.revision)
                  }
                >
                  {t('complete')}
                </Button>
              )}
            </div>
          </section>
        )}
      {readError && (
        <Button variant="outline" onClick={() => void retry()}>{t('retry')}</Button>
      )}
      {!ready && !readError && <p role="status">{t('unavailable')}</p>}
    </div>
  )
}
