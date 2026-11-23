import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from '@/shared/ui/toast'
import { Button } from '@/shared/ui/button'
import type { Account } from '@/shared/renewals/accounts'
import {
  actions,
  attention,
  evidenceKey,
  renewalDate,
  sampleDay,
  WorkflowError,
  type AccountWork,
  type Action,
  type Command,
  type Failure,
} from '@/shared/renewals/workflow'

const field = 'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm'
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
  used,
}: {
  account: Account
  work?: AccountWork
  ready: boolean
  used: number
  save: (account: Account, revision: number, command: Command) => Promise<void>
}) {
  const t = useTranslations('dashboard')
  const fmt = useFormatter()
  const [draft, setDraft] = useState<Editor | null>(null)
  const [error, setError] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const plan = work?.plan
  const status = attention(account, work)
  function edit(mode: Editor['mode']) {
    const recommended: Record<string, Action> = {
      cove: 'resolveIssue',
      ember: 'budget',
      beacon: 'reconnect',
    }
    setDraft({
      mode,
      revision: work?.revision ?? 0,
      owner: plan?.owner ?? '',
      followUp: plan?.followUp ?? '',
      action: plan?.action ?? recommended[account.id] ?? 'checkIn',
      question: work?.information ?? '',
    })
    setError(null)
  }
  async function submit(command: Command, revision: number) {
    setBusy(true)
    setError(null)
    try {
      await save(account, revision, command)
      setDraft(null)
      toast.success(t('confirmed.' + command.type))
    } catch (e) {
      setError(e instanceof WorkflowError ? e.reason : 'storage')
    } finally {
      setBusy(false)
    }
  }
  function dateLabel(value: string) {
    return fmt.dateTime(new Date(value + 'T00:00:00Z'), { dateStyle: 'medium' })
  }
  return (
    <div className="space-y-4 text-sm">
      <section className="rounded-md bg-muted p-3">
        <strong>{t('states.' + status)}</strong>
        <h3 className="mt-2 font-semibold">{t('hypothesis')}</h3>
        <p>{t('hypotheses.' + evidenceKey(account, work))}</p>
        <p className="text-muted-foreground">{t('hypothesisNote')}</p>
      </section>
      {plan && (
        <section className="space-y-1 rounded-md border p-3">
          <h3 className="font-semibold">
            {t(plan.status === 'active' ? 'agreedPlan' : 'completedPlan')}
          </h3>
          <p>
            {t('actions.' + plan.action)} · {plan.owner} ·{' '}
            {dateLabel(plan.followUp)}
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
        {t('sampleDate', { date: dateLabel(sampleDay) })}
      </p>
      {!draft && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !ready} onClick={() => edit('plan')}>
            {t(plan?.status === 'active' ? 'editPlan' : 'newPlan')}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !ready}
            onClick={() => edit('information')}
          >
            {t('ask')}
          </Button>
        </div>
      )}
      {draft && (
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
          {draft.mode === 'plan' ? (
            <>
              <label className="block">
                {t('action')}
                <select
                  autoFocus
                  className={field}
                  value={draft.action}
                  onChange={(e) =>
                    setDraft({ ...draft, action: e.target.value as Action })
                  }
                >
                  {actions.map((action) => (
                    <option key={action} value={action}>
                      {t('actions.' + action)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                {t('owner')}
                <input
                  className={field}
                  required
                  maxLength={80}
                  value={draft.owner}
                  aria-invalid={error === 'ownerRequired'}
                  aria-describedby={
                    error === 'ownerRequired' ? 'decision-error' : undefined
                  }
                  onChange={(e) =>
                    setDraft({ ...draft, owner: e.target.value })
                  }
                />
              </label>
              <label className="block">
                {t('followUp')}
                <input
                  className={field}
                  type="date"
                  required
                  min={sampleDay}
                  max={renewalDate(account.days)}
                  value={draft.followUp}
                  aria-invalid={error === 'invalidDate'}
                  aria-describedby={
                    error === 'invalidDate' ? 'decision-error' : undefined
                  }
                  onChange={(e) =>
                    setDraft({ ...draft, followUp: e.target.value })
                  }
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {t('dateRange', {
                  start: dateLabel(sampleDay),
                  end: dateLabel(renewalDate(account.days)),
                })}
              </p>
            </>
          ) : (
            <label className="block">
              {t('question')}
              <textarea
                autoFocus
                className={field}
                required
                maxLength={400}
                value={draft.question}
                aria-invalid={error === 'questionRequired'}
                aria-describedby={
                  error === 'questionRequired' ? 'decision-error' : undefined
                }
                onChange={(e) =>
                  setDraft({ ...draft, question: e.target.value })
                }
              />
            </label>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !ready}>
              {t(draft.mode === 'plan' ? 'savePlan' : 'saveRequest')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDraft(null)
                setError(null)
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p
          role="alert"
          id="decision-error"
          className="font-medium text-destructive"
        >
          {t('errors.' + error)}
        </p>
      )}

      {!draft &&
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
      {!ready && <p role="status">{t('unavailable')}</p>}
    </div>
  )
}
