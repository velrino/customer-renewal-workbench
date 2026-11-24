import { useEnvironment } from '@/shared/api/environment'
import { RelativeDate } from '@/shared/ui/relative-date'
import * as Tabs from '@radix-ui/react-tabs'
import { useId, useState, type ReactNode } from 'react'
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
  children,
}: {
  children: ReactNode
  account: Account
  work?: AccountWork
  ready: boolean
  readError: boolean
  retry: () => Promise<void>
  used: number
  save: (account: Account, revision: number, command: Command) => Promise<void>
}) {
  const t = useTranslations('dashboard')
  const limit = useTranslations('rateLimit')
  const { environment, availability } = useEnvironment()
  const sharedUnavailable = environment === 'api' && availability !== 'available'
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
      toast.success(t('confirmed.' + command.type), {
        description: command.type === 'complete' && status === 'review'
          ? t('reviewCompleted', { name: account.name, signal: t('signals.' + evidenceKey(account, work)) })
          : undefined,
      })
    } catch (e) {
      const reason = e instanceof WorkflowError ? e.reason : 'storage'
      setError(reason)
      toast.error(t('errors.' + reason), {
        id: 'account-decision-error',
        description: e instanceof WorkflowError && e.retryAfterSeconds ? limit('retryAfter', { seconds: e.retryAfterSeconds }) : undefined,
      })
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
    <div data-demo-account-status={plan?.status} className="space-y-4 text-sm">
      <Tabs.Root defaultValue="overview">
        <Tabs.List aria-label={t('accountSections')} className="mb-4 grid grid-cols-3 rounded-lg bg-muted p-1">
          {(['overview', 'plan', 'owner'] as const).map(section => (
            <Tabs.Trigger data-demo-tab={section} key={section} value={section}
              className="rounded-md px-1 py-1.5 text-sm font-medium text-muted-foreground focus-visible:outline-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              {t('accountTabs.' + section)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="overview" className="space-y-3">
          {children}
          <section className="rounded-md bg-muted p-3">
            <strong className={status === 'reviewed' ? 'inline-flex rounded-full bg-green-700 px-2 py-0.5 text-xs text-white' : undefined}>
              {t('states.' + status)}
            </strong>
            <h3 className="mt-2 font-semibold">{t('hypothesis')}</h3>
            <p>{t('hypotheses.' + evidenceKey(account, work))}</p>
          </section>
        </Tabs.Content>
        <Tabs.Content value="plan" className="space-y-3">
          {!editing && (
            <>
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
              <Button data-demo="plan" className="ms-auto" disabled={busy || !ready} onClick={() => edit('plan')}>
                {t(plan?.status === 'active' ? 'editPlan' : 'newPlan')}
              </Button>
            </div>
          )}
          {editing && draft && (
            <form data-demo="editor"
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
        </Tabs.Content>
        <Tabs.Content value="owner" className="space-y-3">
          {((account.critical && !work?.issueResolved) ||
            plan?.status === 'active') ? (
            <section className="space-y-2">
              <h3 className="font-semibold">{t('simulation')}</h3>
              <p className="text-muted-foreground">{t('simulationNote')}</p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {account.critical && !work?.issueResolved && (
                  <Button
                    disabled={busy || !ready}
                    variant="outline"
                    className="border-blue-300 text-blue-800 hover:bg-blue-50 hover:text-blue-900 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-950"
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
                    data-demo="complete"
                    className="ms-auto bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-800 dark:hover:bg-emerald-700"
                    onClick={() =>
                      void submit({ type: 'complete' }, work!.revision)
                    }
                  >
                    {t('complete')}
                  </Button>
                )}
              </div>
            </section>
          ) : <p className="text-muted-foreground">{t('noOwnerActions')}</p>}
        </Tabs.Content>
      </Tabs.Root>
      {readError && (
        <Button variant="outline" onClick={() => void retry()}>{t('retry')}</Button>
      )}
      {sharedUnavailable ? <p role="status">{t('sharedOffline')}</p> : !ready && !readError && <p role="status">{t('unavailable')}</p>}
    </div>
  )
}
