'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon, LockOpenIcon, ShieldAlertIcon } from 'lucide-react'
import { Amount } from '@/components/finance/amount'
import { ReconciliationRow } from '@/components/finance/reconciliation-row'
import { PageHeader } from '@/components/shared/page-header'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState, ErrorState, Notice, TableSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/menus'
import { useCloseDay, useReconCalendar, useReconciliationDay, useReopenDay } from '@/hooks/api'
import { useIsDesktop } from '@/hooks/use-media-query'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { addMonthKey, formatDate, formatDateTime, formatMonth, formatWeekday, monthKey } from '@/lib/dates'
import { formatPeso, sumBy } from '@/lib/money'
import { cn, formatCount } from '@/lib/utils'
import type { ReconCalendarDay } from '@/types'

export default function ReconciliationPage() {
  return (
    <RoleGate permission="recon.view" page="reconciliation">
      <React.Suspense>
        <Board />
      </React.Suspense>
    </RoleGate>
  )
}

function Board() {
  const params = useSearchParams()
  const { market, date: ctxDate, today } = useAppContext()
  const [date, setDate] = React.useState(params.get('date') ?? ctxDate)
  const [month, setMonth] = React.useState(monthKey(params.get('date') ?? ctxDate))
  const desktop = useIsDesktop()
  const can = useCan()
  const day = useReconciliationDay(date, market)
  const cal = useReconCalendar(month, market)
  const close = useCloseDay()
  const reopen = useReopenDay()
  const [closeOpen, setCloseOpen] = React.useState(false)
  const [reopenOpen, setReopenOpen] = React.useState(false)

  const firstCtx = React.useRef(true)
  React.useEffect(() => {
    if (firstCtx.current) {
      firstCtx.current = false
      return
    }
    setDate(ctxDate)
    setMonth(monthKey(ctxDate))
  }, [ctxDate])

  const pick = (d: string) => {
    setDate(d)
    setMonth(monthKey(d))
  }

  const rows = day.data?.rows ?? []
  const withRemit = rows.filter((r) => r.remittances.length > 0)
  const closed = day.data?.dayClose.closed ?? false

  return (
    <>
      <PageHeader
        title={t.pages.reconciliation.title}
        description={t.pages.reconciliation.description}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Day</span>
            <Input type="date" max={today} value={date} onChange={(e) => e.target.value && pick(e.target.value)} className="w-40" />
          </label>
        }
      />

      <CalendarStrip month={month} onMonth={setMonth} days={cal.data} selected={date} onPick={pick} today={today} />

      <section aria-labelledby="day-heading" className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="day-heading" className="font-heading text-section font-semibold">
              {formatWeekday(date)}, {formatDate(date)}
            </h2>
            {day.data ? (
              <p className="text-sm text-ink-muted">
                {closed ? (
                  <span className="inline-flex items-center gap-1">
                    <LockIcon className="size-3.5" aria-hidden /> Closed by {day.data.dayClose.closedByName} on {formatDateTime(day.data.dayClose.closedAt)}
                  </span>
                ) : (
                  'Open — figures can still change'
                )}
                {day.data.dayClose.reopenings.length ? ` · reopened ${day.data.dayClose.reopenings.length}×` : ''}
              </p>
            ) : null}
          </div>
          {day.data && can('recon.closeDay') ? (
            closed ? (
              <Button variant="secondary" onClick={() => setReopenOpen(true)}>
                <LockOpenIcon /> Reopen day
              </Button>
            ) : (
              <Tooltip content={day.data.canClose ? 'Lock this day for every market' : day.data.closeBlockers[0]}>
                <span tabIndex={day.data.canClose ? undefined : 0}>
                  <Button onClick={() => setCloseOpen(true)} disabled={!day.data.canClose}>
                    <LockIcon /> Close day
                  </Button>
                </span>
              </Tooltip>
            )
          ) : null}
        </div>

        {day.data && !closed && day.data.closeBlockers.length ? (
          <Notice tone="warning" icon={<AlertTriangleIcon />} className="mb-4">
            <p className="font-medium">Before this day can be closed:</p>
            <ul className="mt-1 list-disc pl-5">
              {day.data.closeBlockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
        {day.data?.dayClose.reopenings.length ? (
          <Notice tone="info" icon={<ShieldAlertIcon />} className="mb-4">
            {day.data.dayClose.reopenings.map((r) => (
              <p key={r.at}>
                Reopened {formatDateTime(r.at)} by {r.byName}: “{r.reason}”
              </p>
            ))}
          </Notice>
        ) : null}

        {day.isLoading && !day.data ? (
          <TableSkeleton rows={6} />
        ) : day.isError ? (
          <ErrorState onRetry={() => day.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No collections on this day" description="Nothing was recorded by collectors for the selected market and day." />
        ) : desktop ? (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Reconciliation by collector for {formatDate(date)}</caption>
              <thead>
                <tr className="text-left text-xs font-semibold text-ink-muted">
                  {['Collector', 'Collections', 'Recorded', 'Remitted', 'Variance', 'Accountable forms used', 'Status', ''].map((h, i) => (
                    <th key={i} scope="col" className={cn('border-b border-border bg-surface-muted px-3 py-2.5', i >= 1 && i <= 4 && 'text-right')}>
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <ReconciliationRow key={r.collectorId} row={r} closed={closed} desktop />
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="border-t-2 border-border-strong bg-surface-muted px-3 py-2.5 text-ink-muted">Totals · {rows.length} collectors</td>
                  <td className="num border-t-2 border-border-strong bg-surface-muted px-3 py-2.5 text-right">{formatCount(sumBy(rows, (r) => r.collectionsCount))}</td>
                  <td className="border-t-2 border-border-strong bg-surface-muted px-3 py-2.5 text-right">
                    <Amount value={sumBy(rows, (r) => r.expected)} />
                  </td>
                  <td className="border-t-2 border-border-strong bg-surface-muted px-3 py-2.5 text-right">
                    <Amount value={sumBy(rows, (r) => r.remitted)} />
                  </td>
                  <td className="border-t-2 border-border-strong bg-surface-muted px-3 py-2.5 text-right">
                    <Amount value={sumBy(withRemit, (r) => r.variance)} signed positiveTone />
                  </td>
                  <td colSpan={3} className="border-t-2 border-border-strong bg-surface-muted px-3 py-2.5 text-xs font-normal text-ink-muted">
                    Variance counts only collectors who have remitted.
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        ) : (
          <Card>
            <ul aria-label={`Reconciliation by collector for ${formatDate(date)}`}>
              {rows.map((r) => (
                <ReconciliationRow key={r.collectorId} row={r} closed={closed} desktop={false} />
              ))}
            </ul>
            <dl className="grid grid-cols-3 gap-2 bg-surface-muted px-4 py-3 text-[13px] font-semibold">
              <div>
                <dt className="text-xs font-normal text-ink-muted">Recorded</dt>
                <dd>
                  <Amount value={sumBy(rows, (r) => r.expected)} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-normal text-ink-muted">Remitted</dt>
                <dd>
                  <Amount value={sumBy(rows, (r) => r.remitted)} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-normal text-ink-muted">Variance</dt>
                <dd>
                  <Amount value={sumBy(withRemit, (r) => r.variance)} signed positiveTone />
                </dd>
              </div>
            </dl>
          </Card>
        )}
      </section>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Close {formatDate(date)}?</AlertDialogTitle>
          <AlertDialogDescription>
            This locks the day for both markets: remittances, corrections and flags can no longer be changed. Total recorded {formatPeso(sumBy(rows, (r) => r.expected))}, remitted {formatPeso(sumBy(rows, (r) => r.remitted))}. Reopening later requires a reason and is audited.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => close.mutate(date, { onSuccess: () => toast.success(`${formatDate(date)} closed.`) })}>Close day</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <ReasonDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title={`Reopen ${formatDate(date)}?`}
        description="Reopening unlocks the day so remittances and corrections can be changed. The reason is kept on the day and in the audit log."
        confirmLabel="Reopen day"
        minLength={10}
        pending={reopen.isPending}
        onConfirm={(reason) =>
          reopen.mutate(
            { date, reason },
            {
              onSuccess: () => {
                toast.success(`${formatDate(date)} reopened.`)
                setReopenOpen(false)
              },
            },
          )
        }
      />
    </>
  )
}

function CalendarStrip({ month, onMonth, days, selected, onPick, today }: { month: string; onMonth: (m: string) => void; days: ReconCalendarDay[] | undefined; selected: string; onPick: (d: string) => void; today: string }) {
  const label: Record<ReconCalendarDay['state'], string> = { closed: 'Closed', open: 'Open', variance: 'With variance', future: 'No data' }
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => onMonth(addMonthKey(month, -1))}>
            <ChevronLeftIcon />
          </Button>
          <p className="min-w-32 text-center font-heading font-semibold">{formatMonth(month)}</p>
          <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => onMonth(addMonthKey(month, 1))} disabled={month >= monthKey(today)}>
            <ChevronRightIcon />
          </Button>
        </div>
        <ul className="hidden flex-wrap gap-3 text-xs text-ink-muted sm:flex" aria-label="Calendar legend">
          <li className="flex items-center gap-1">
            <span aria-hidden className="size-2.5 rounded-sm bg-[var(--st-reconciled)]" /> Closed
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden className="size-2.5 rounded-sm border border-[var(--st-pending)]" /> Open
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden className="size-2.5 rounded-sm bg-[var(--st-variance)]" /> With variance
          </li>
        </ul>
      </div>
      <ol className="scrollbar-thin flex gap-1 overflow-x-auto pb-1" aria-label={`Days of ${formatMonth(month)}`}>
        {(days ?? []).map((d) => {
          const n = Number(d.date.slice(8))
          const disabled = d.state === 'future'
          const isSel = d.date === selected
          return (
            <li key={d.date}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(d.date)}
                aria-pressed={isSel}
                aria-label={`${formatDate(d.date)}: ${label[d.state]}${d.closed && d.state === 'variance' ? ', closed' : ''}${d.variance ? `, variance ${formatPeso(d.variance)}` : ''}`}
                className={cn(
                  'relative flex h-14 w-10 flex-col items-center justify-center rounded-md border text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  d.state === 'closed' && 'border-transparent bg-money-in-soft text-ink',
                  d.state === 'open' && 'border-border-strong bg-surface',
                  d.state === 'variance' && 'border-transparent bg-money-short-soft text-ink',
                  d.state === 'future' && 'border-dashed border-border',
                  isSel && 'ring-2 ring-accent ring-offset-1 ring-offset-surface',
                  d.date === today && 'font-bold',
                )}
              >
                <span className="text-[10px] text-ink-muted uppercase">{formatWeekday(d.date).slice(0, 2)}</span>
                <span className="num text-sm">{n}</span>
                <span aria-hidden className="mt-0.5 h-3">
                  {d.state === 'closed' ? <LockIcon className="size-3 text-money-in" /> : d.state === 'variance' ? (d.closed ? <LockIcon className="size-3 text-money-short" /> : <AlertTriangleIcon className="size-3 text-money-short" />) : d.state === 'open' ? <span className="block size-1.5 rounded-full bg-ink-subtle" /> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
