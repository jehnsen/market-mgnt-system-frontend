'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { AlertTriangleIcon, MessageSquareOffIcon, SearchIcon, SendIcon } from 'lucide-react'
import { Amount, StallCode } from '@/components/finance/amount'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState, Notice } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls'
import { Field, Label } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { Progress, Skeleton } from '@/components/ui/misc'
import { useRecipients, useSections, useSendSms, useSmsLog, useSmsSettings, useSmsTemplates, useSmsUsage } from '@/hooks/api'
import { t } from '@/i18n'
import type { Recipient, RecipientGroup } from '@/lib/api'
import { useAppContext } from '@/lib/app-context'
import { endOfMonth, formatDate, formatDateTime, formatMonth, monthKey } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import { MERGE_FIELDS, renderTemplate, smsUnits } from '@/lib/sms'
import { cn, formatCount } from '@/lib/utils'
import type { SmsMessage, SmsStatus } from '@/types'

export default function MessagesPage() {
  return (
    <RoleGate permission="messages.view" page="SMS reminders">
      <React.Suspense>
        <Messages />
      </React.Suspense>
    </RoleGate>
  )
}

function Messages() {
  const params = useSearchParams()
  const settings = useSmsSettings()
  const usage = useSmsUsage()
  const can = useCan()
  const [tab, setTab] = React.useState(params.get('status') ? 'log' : can('messages.send') ? 'send' : 'log')

  if (settings.data && !settings.data.enabled) {
    return (
      <>
        <PageHeader title={t.pages.messages.title} description={t.pages.messages.description} />
        <Card>
          <EmptyState
            icon={<MessageSquareOffIcon />}
            title="SMS reminders are turned off"
            description="An Administrator has disabled SMS for this LGU. No reminders can be sent or scheduled until it is turned back on in Settings → SMS."
            action={
              <Button asChild variant="secondary">
                <Link href="/app/settings/sms">Open SMS settings</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  const u = usage.data
  const pct = u ? (u.used / Math.max(1, u.allowance)) * 100 : 0
  const warn = u ? pct >= u.warnAtPercent : false

  return (
    <>
      <PageHeader title={t.pages.messages.title} description={t.pages.messages.description} />
      <Card className="mb-6">
        <CardBody className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">SMS used in {u?.year ?? ''}</p>
              <p className="num text-sm">
                {u ? `${formatCount(u.used)} of ${formatCount(u.allowance)} units · ${pct.toFixed(1)}%` : '—'}
              </p>
            </div>
            <Progress value={pct} className="mt-2 h-2.5" indicatorClassName={warn ? 'bg-accent' : undefined} aria-label="SMS allowance used" />
            {warn ? (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-accent-ink">
                <AlertTriangleIcon className="size-4" aria-hidden /> Over {u?.warnAtPercent}% of the yearly allowance is used. Send only essential reminders.
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-ink-muted">Warning shows at {u?.warnAtPercent ?? 80}% of the allowance.</p>
            )}
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">Sent this month</dt>
              <dd className="num font-semibold">{formatCount(u?.sentThisMonth ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Failed this month</dt>
              <dd className={cn('num font-semibold', (u?.failedThisMonth ?? 0) > 0 && 'text-money-short')}>{formatCount(u?.failedThisMonth ?? 0)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="SMS sections">
          {can('messages.send') ? <TabsTrigger value="send">Send reminders</TabsTrigger> : null}
          <TabsTrigger value="log">Message log</TabsTrigger>
        </TabsList>
        {can('messages.send') ? (
          <TabsContent value="send">
            <Composer preselected={params.get('lessee')} remaining={u ? u.allowance - u.used : null} onSent={() => setTab('log')} />
          </TabsContent>
        ) : null}
        <TabsContent value="log">
          <Log initialStatus={(params.get('status') as SmsStatus) ?? 'all'} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function Composer({ preselected, remaining, onSent }: { preselected: string | null; remaining: number | null; onSent: () => void }) {
  const { market, today } = useAppContext()
  const templates = useSmsTemplates()
  const sections = useSections(market)
  const [group, setGroup] = React.useState<RecipientGroup>(preselected ? 'selected' : 'overdue')
  const [sectionId, setSectionId] = React.useState('')
  const [templateId, setTemplateId] = React.useState(preselected ? 'tpl-overdue' : 'tpl-overdue')
  const [excluded, setExcluded] = React.useState<Set<string>>(new Set())
  const [when, setWhen] = React.useState<'now' | 'later'>('now')
  const [scheduleAt, setScheduleAt] = React.useState(`${today}T16:00`)
  const recipients = useRecipients({ group, market, sectionId: group === 'section' ? sectionId : undefined, lesseeIds: group === 'selected' && preselected ? [preselected] : undefined })
  const send = useSendSms()
  const tpl = templates.data?.find((x) => x.id === templateId)
  const eligible = (recipients.data?.eligible ?? []).filter((r) => !excluded.has(r.lesseeId))
  const sample = eligible[0]
  const varsFor = (r: Recipient) => ({
    name: r.name,
    stall: r.stallCodes.join(', ') || '—',
    market: r.marketId === 'sm' ? 'Seafood Market' : 'Public Market',
    balance: formatPeso(r.balance),
    amount: formatPeso(r.monthlyRate),
    month: formatMonth(monthKey(today)),
    due_date: formatDate(endOfMonth(monthKey(today))),
    lease_end: formatDate(r.leaseEnd),
    as_of: formatDate(today),
  })
  const preview = tpl && sample ? renderTemplate(tpl.body, varsFor(sample)) : (tpl?.body ?? '')
  const units = tpl ? eligible.reduce((s, r) => s + smsUnits(renderTemplate(tpl.body, varsFor(r))), 0) : 0
  const over = remaining !== null && units > remaining

  React.useEffect(() => {
    // Suggest the template that fits the chosen group.
    const map: Partial<Record<RecipientGroup, string>> = { overdue: 'tpl-overdue', expiring: 'tpl-expiring', section: 'tpl-advisory' }
    const next = map[group]
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next) setTemplateId(next)
    setExcluded(new Set())
  }, [group])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recipients</CardTitle>
            <CardDescription>Only lessees who agreed to SMS reminders are listed.</CardDescription>
          </div>
        </CardHeader>
        <CardBody className="grid gap-4">
          <RadioGroup value={group} onValueChange={(v) => setGroup(v as RecipientGroup)} aria-label="Who should receive this" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['overdue', 'Overdue accounts', 'Lessees with unpaid rentals past due'],
                ['expiring', 'Leases expiring', 'Leases ending in the next 30 days'],
                ['section', 'A section', 'Everyone with a stall in one section'],
                ['selected', 'Selected lessee', preselected ? 'Opened from a lessee or stall record' : 'Open from a lessee record to pick'],
              ] as [RecipientGroup, string, string][]
            ).map(([v, label, hint]) => (
              <label key={v} htmlFor={`g-${v}`} className="flex cursor-pointer gap-3 rounded-md border border-border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft/50">
                <RadioGroupItem id={`g-${v}`} value={v} className="mt-0.5" disabled={v === 'selected' && !preselected} />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-ink-muted">{hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
          {group === 'section' ? (
            <Field label="Section" htmlFor="sms-section">
              <NativeSelect id="sms-section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">Choose a section…</option>
                {sections.data
                  ?.filter((s) => s.stallCount > 0)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          ) : null}
          {recipients.isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <p className="text-sm" aria-live="polite">
                <strong>{formatCount(eligible.length)}</strong> recipients
                {recipients.data?.excludedNoConsent ? <span className="text-ink-muted"> · {recipients.data.excludedNoConsent} left out (no SMS consent)</span> : null}
              </p>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {(recipients.data?.eligible ?? []).map((r) => {
                  const on = !excluded.has(r.lesseeId)
                  return (
                    <li key={r.lesseeId} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        id={`rc-${r.lesseeId}`}
                        checked={on}
                        onChange={() =>
                          setExcluded((s) => {
                            const n = new Set(s)
                            if (on) n.add(r.lesseeId)
                            else n.delete(r.lesseeId)
                            return n
                          })
                        }
                        className="size-4 accent-[var(--primary)]"
                      />
                      <label htmlFor={`rc-${r.lesseeId}`} className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="flex flex-wrap gap-1 text-xs text-ink-muted">
                          {r.stallCodes.map((c) => (
                            <StallCode key={c} code={c} className="text-[11px]" />
                          ))}
                        </span>
                      </label>
                      {r.balance > 0 ? <Amount value={r.balance} size="sm" /> : null}
                    </li>
                  )
                })}
                {recipients.data?.eligible.length === 0 ? <li className="px-3 py-6 text-center text-sm text-ink-muted">No consenting lessees in this group.</li> : null}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4">
          <Field label="Template" htmlFor="sms-tpl">
            <NativeSelect id="sms-tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.data?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div>
            <Label>Preview{sample ? ` for ${sample.name}` : ''}</Label>
            <div className="mt-1.5 rounded-lg rounded-bl-none bg-primary-soft px-3 py-2.5 text-sm leading-relaxed">{preview}</div>
            <p className="mt-1 text-xs text-ink-muted">
              {preview.length} characters · {smsUnits(preview)} unit{smsUnits(preview) === 1 ? '' : 's'} each
            </p>
            <details className="mt-2 text-xs text-ink-muted">
              <summary className="cursor-pointer">Merge fields</summary>
              <ul className="mt-1 grid gap-0.5">
                {MERGE_FIELDS.map((f) => (
                  <li key={f.key}>
                    <code className="num">{`{{${f.key}}}`}</code> — {f.label}
                  </li>
                ))}
              </ul>
            </details>
          </div>
          <RadioGroup value={when} onValueChange={(v) => setWhen(v as 'now' | 'later')} aria-label="When to send" className="flex gap-4">
            <label className="flex items-center gap-2 text-sm" htmlFor="w-now">
              <RadioGroupItem id="w-now" value="now" /> Send now
            </label>
            <label className="flex items-center gap-2 text-sm" htmlFor="w-later">
              <RadioGroupItem id="w-later" value="later" /> Schedule
            </label>
          </RadioGroup>
          {when === 'later' ? (
            <Field label="Send at" htmlFor="sms-at">
              <Input id="sms-at" type="datetime-local" value={scheduleAt} min={`${today}T00:00`} onChange={(e) => setScheduleAt(e.target.value)} />
            </Field>
          ) : null}
          {over ? <Notice tone="danger">This batch needs {units} units but only {remaining} remain this year.</Notice> : null}
        </CardBody>
        <CardFooter className="justify-between">
          <span className="text-[13px] text-ink-muted">{formatCount(units)} units</span>
          <Button
            disabled={eligible.length === 0 || !tpl || over || send.isPending}
            onClick={() =>
              send.mutate(
                { templateId, lesseeIds: eligible.map((r) => r.lesseeId), scheduleAt: when === 'later' ? `${scheduleAt}:00+08:00` : null },
                {
                  onSuccess: (r) => {
                    toast.success(when === 'later' ? `${r.queued} messages scheduled.` : `${r.queued} messages sent (${r.units} units).`)
                    onSent()
                  },
                },
              )
            }
          >
            <SendIcon /> {when === 'later' ? 'Schedule' : 'Send'} to {eligible.length}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function Log({ initialStatus }: { initialStatus: SmsStatus | 'all' }) {
  const templates = useSmsTemplates()
  const [status, setStatus] = React.useState<SmsStatus | 'all'>(initialStatus)
  const [templateId, setTemplateId] = React.useState('all')
  const [q, setQ] = React.useState('')
  const log = useSmsLog({ status, templateId, q })
  const columns = React.useMemo<ColumnDef<SmsMessage, unknown>[]>(
    () => [
      { id: 'to', header: 'Recipient', accessorFn: (r) => r.recipientName, cell: ({ row }) => <Link href={`/app/lessees/${row.original.lesseeId}`} className="font-medium hover:underline">{row.original.recipientName}</Link>, meta: { primary: true, label: 'Recipient' } },
      { id: 'tpl', header: 'Template', accessorFn: (r) => r.templateName, meta: { label: 'Template' } },
      { id: 'body', header: 'Message', accessorFn: (r) => r.body, cell: ({ getValue }) => <span className="line-clamp-1 max-w-80 text-[13px] text-ink-muted" title={String(getValue())}>{String(getValue())}</span>, enableSorting: false, meta: { label: 'Message' } },
      { id: 'at', header: 'Sent at', accessorFn: (r) => r.sentAt ?? r.scheduledFor ?? r.createdAt, cell: ({ row }) => <span className="whitespace-nowrap text-[13px]">{row.original.status === 'queued' ? `Scheduled ${formatDateTime(row.original.scheduledFor)}` : formatDateTime(row.original.sentAt ?? row.original.createdAt)}</span>, meta: { label: 'Sent at' } },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.status,
        cell: ({ row }) => (
          <span className="grid gap-0.5">
            <StatusBadge kind="sms" value={row.original.status} />
            {row.original.failureReason ? <span className="text-xs text-money-short">{row.original.failureReason}</span> : null}
          </span>
        ),
        meta: { label: 'Status' },
      },
      { id: 'units', header: 'Units', accessorFn: (r) => r.costUnits, cell: ({ getValue }) => <span className="num">{String(getValue())}</span>, meta: { align: 'right', label: 'Units', footer: (rows) => <span className="num">{formatCount(rows.reduce((s, r) => s + r.costUnits, 0))}</span> } },
    ],
    [],
  )
  return (
    <DataTable
      data={log.data}
      isLoading={log.isLoading}
      isError={log.isError}
      onRetry={() => log.refetch()}
      columns={columns}
      getRowId={(r) => r.id}
      caption="SMS log"
      dense
      footerLabel={<span className="text-ink-muted">Units · {formatCount(log.data?.length ?? 0)} messages</span>}
      toolbar={
        <>
          <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as SmsStatus | 'all')} className="h-8 w-36">
            <option value="all">All statuses</option>
            {(['queued', 'sent', 'failed'] as const).map((s) => (
              <option key={s} value={s}>
                {t.smsStatus[s]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-8 w-52">
            <option value="all">All templates</option>
            {templates.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </NativeSelect>
          <span className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recipient or text" aria-label="Search messages" className="h-8 w-52 pl-8" />
          </span>
        </>
      }
    />
  )
}
