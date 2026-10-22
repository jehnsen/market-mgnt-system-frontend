'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { CalendarCheck2Icon, GavelIcon, PlayIcon } from 'lucide-react'
import { Amount, StallCode } from '@/components/finance/amount'
import { BILLING_TABS, LinkTabs } from '@/components/layout/link-tabs'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { marketName } from '@/config/lgu'
import { useBillingPreview, useBillingRuns, useGenerateBilling, usePenaltyPolicy } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { addMonthKey, formatDateTime, formatMonth, monthKey } from '@/lib/dates'
import { formatBps, formatPeso, sumBy } from '@/lib/money'
import { formatCount } from '@/lib/utils'
import type { BillingPreviewLine } from '@/types'

export default function BillingPage() {
  return (
    <RoleGate permission="billing.view" page="billing">
      <PageHeader title={t.pages.billing.title} description={t.pages.billing.description} />
      <LinkTabs tabs={BILLING_TABS} label="Billing sections" />
      <BillingRun />
    </RoleGate>
  )
}

function BillingRun() {
  const { today } = useAppContext()
  const can = useCan()
  const runs = useBillingRuns()
  const nextMonth = addMonthKey(monthKey(today), 1)
  const [month, setMonth] = React.useState(nextMonth)
  const preview = useBillingPreview(month)
  const generate = useGenerateBilling()
  const policy = usePenaltyPolicy()
  const [confirm, setConfirm] = React.useState(false)
  const p = preview.data

  const columns = React.useMemo<ColumnDef<BillingPreviewLine, unknown>[]>(
    () => [
      { id: 'stall', header: 'Stall', accessorFn: (r) => r.stallCode, cell: ({ row }) => <StallCode code={row.original.stallCode} />, sortingFn: (a, b) => a.original.stallCode.localeCompare(b.original.stallCode, undefined, { numeric: true }), meta: { label: 'Stall' } },
      { id: 'lessee', header: 'Lessee', accessorFn: (r) => r.lesseeName, meta: { primary: true, label: 'Lessee' } },
      { id: 'lease', header: 'Lease', accessorFn: (r) => r.leaseNo, cell: ({ getValue }) => <span className="num text-[13px] text-ink-muted">{String(getValue())}</span>, meta: { label: 'Lease' } },
      { id: 'section', header: 'Market · section', accessorFn: (r) => `${marketName(r.marketId, true)} · ${r.sectionName}`, cell: ({ getValue }) => <span className="text-ink-muted">{String(getValue())}</span>, meta: { label: 'Section' } },
      { id: 'rental', header: 'Rental', accessorFn: (r) => r.rental, cell: ({ row }) => <Amount value={row.original.rental} />, meta: { align: 'right', label: 'Rental', footer: (rows) => <Amount value={sumBy(rows, (r) => r.rental)} /> } },
      { id: 'overdue', header: 'Overdue rental', accessorFn: (r) => r.overdueRental, cell: ({ row }) => <Amount value={row.original.overdueRental} dashZero className="text-ink-muted" />, meta: { align: 'right', label: 'Overdue rental' } },
      { id: 'penalty', header: 'Surcharge', accessorFn: (r) => r.penalty, cell: ({ row }) => <Amount value={row.original.penalty} dashZero />, meta: { align: 'right', label: 'Surcharge', footer: (rows) => <Amount value={sumBy(rows, (r) => r.penalty)} /> } },
      { id: 'total', header: 'Total charge', accessorFn: (r) => r.total, cell: ({ row }) => <Amount value={row.original.total} className="font-medium" />, meta: { align: 'right', label: 'Total', footer: (rows) => <Amount value={sumBy(rows, (r) => r.total)} /> } },
    ],
    [],
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid min-w-0 gap-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Monthly billing run</CardTitle>
              <CardDescription>Preview the rental and surcharge charges for every active lease, then generate them.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-ink-muted">Month</span>
                <Input type="month" value={month} max={nextMonth} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />
              </label>
              {can('billing.run') ? (
                <Button onClick={() => setConfirm(true)} disabled={!p || Boolean(p.alreadyGenerated) || p.lines.length === 0}>
                  <PlayIcon /> Generate billing
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            {p?.alreadyGenerated ? (
              <Notice tone="success" icon={<CalendarCheck2Icon />}>
                Billing for {formatMonth(p.month)} was generated on {formatDateTime(p.alreadyGenerated.generatedAt)} by {p.alreadyGenerated.generatedByName}. The lines below are the charges as billed.
              </Notice>
            ) : p ? (
              <Notice tone="info">
                Preview only. Nothing is charged until you generate. {formatCount(p.lines.length)} active leases · surcharge {formatBps(p.penaltyRateBps)} a month on overdue rental ({p.ordinanceRef}).
              </Notice>
            ) : null}
            {p ? (
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs text-ink-muted">Rental</dt>
                  <dd>
                    <Amount value={p.rentalTotal} size="lg" />
                  </dd>
                </div>
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs text-ink-muted">Surcharges</dt>
                  <dd>
                    <Amount value={p.penaltyTotal} size="lg" />
                  </dd>
                </div>
                <div className="rounded-md border border-primary/40 bg-primary-soft p-3">
                  <dt className="text-xs text-ink">Total to bill</dt>
                  <dd>
                    <Amount value={p.total} size="lg" />
                  </dd>
                </div>
              </dl>
            ) : null}
          </CardBody>
        </Card>
        <DataTable data={p?.lines} isLoading={preview.isLoading} isError={preview.isError} onRetry={() => preview.refetch()} columns={columns} getRowId={(r) => r.leaseId} caption={`Billing lines for ${formatMonth(month)}`} initialHidden={['lease']} dense />
      </div>

      <aside className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GavelIcon className="size-4 text-primary" aria-hidden />
              <CardTitle>Penalty settings</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="grid gap-2 text-sm">
            {policy.data ? (
              <>
                <p>
                  <span className="num text-2xl font-semibold">{formatBps(policy.data.schedule.penaltyRateBps)}</span> <span className="text-ink-muted">per month on overdue rental</span>
                </p>
                <p className="text-ink-muted">{policy.data.schedule.penaltyRule}</p>
                <p className="text-[13px]">
                  <span className="text-ink-muted">Basis:</span> {policy.data.schedule.penaltyOrdinanceRef}
                </p>
                <p className="text-[13px]">
                  <span className="text-ink-muted">Fee schedule:</span> v{policy.data.schedule.version}, {policy.data.schedule.ordinanceRef}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Read-only here. {can('settings.fees') ? <Link className="text-primary underline" href="/app/settings/fees">Edit in Settings</Link> : 'Changed in Settings by the Administrator or Treasurer.'}
                </p>
              </>
            ) : (
              <p className="text-ink-muted">{t.common.loading}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Run history</CardTitle>
          </CardHeader>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {runs.data?.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setMonth(r.month)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-muted/60 sm:px-5">
                  <span>
                    <span className="block font-medium">{formatMonth(r.month)}</span>
                    <span className="block text-xs text-ink-muted">{r.leaseCount} leases · {r.generatedByName}</span>
                  </span>
                  <Amount value={r.rentalTotal + r.penaltyTotal} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </aside>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Generate billing for {formatMonth(month)}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-2 text-sm text-ink-muted">
              <p>This charges every active lease once for the month. Charges cannot be generated twice for the same month.</p>
              {p ? (
                <dl className="grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-3 text-ink">
                  <dt>Leases</dt>
                  <dd className="num text-right">{formatCount(p.lines.length)}</dd>
                  <dt>Rental</dt>
                  <dd className="num text-right">{formatPeso(p.rentalTotal)}</dd>
                  <dt>Surcharges</dt>
                  <dd className="num text-right">{formatPeso(p.penaltyTotal)}</dd>
                  <dt className="font-semibold">Total</dt>
                  <dd className="num text-right font-semibold">{formatPeso(p.total)}</dd>
                </dl>
              ) : null}
            </div>
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => generate.mutate(month, { onSuccess: (r) => toast.success(`Billing for ${formatMonth(r.month)} generated: ${r.leaseCount} leases, ${formatPeso(r.rentalTotal + r.penaltyTotal)}.`) })}>Generate</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
