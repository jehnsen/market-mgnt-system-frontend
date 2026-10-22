'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { AlertTriangleIcon, ArrowDownUpIcon, CopyIcon, FilePlus2Icon, FileTextIcon, MoreHorizontalIcon, PackageXIcon, Undo2Icon } from 'lucide-react'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menus'
import { useCollectors, useFormAlerts, useFormSeries, useFormTypes, useIssueSeries, useReportMissing, useReturnSeries } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatDate } from '@/lib/dates'
import { formatCount } from '@/lib/utils'
import type { AccountableFormSeriesView, FormAlert, SeriesStatus } from '@/types'

const pad = (n: number | null) => (n === null ? '—' : String(n).padStart(7, '0'))

export default function AccountableFormsPage() {
  return (
    <RoleGate permission="forms.view" page="accountable forms">
      <Forms />
    </RoleGate>
  )
}

function Forms() {
  const { today } = useAppContext()
  const can = useCan()
  const [formType, setFormType] = React.useState('all')
  const [collectorId, setCollectorId] = React.useState('all')
  const [status, setStatus] = React.useState<SeriesStatus | 'all'>('all')
  const [issueOpen, setIssueOpen] = React.useState(false)
  const [missing, setMissing] = React.useState<AccountableFormSeriesView | null>(null)
  const types = useFormTypes()
  const collectors = useCollectors('all', today)
  const series = useFormSeries({ formType, collectorId, status })
  const alerts = useFormAlerts()
  const returnSeries = useReturnSeries()
  const reportMissing = useReportMissing()
  const typeName = React.useCallback((id: string) => types.data?.find((f) => f.id === id)?.shortName ?? id, [types.data])

  const columns = React.useMemo<ColumnDef<AccountableFormSeriesView, unknown>[]>(
    () => [
      { id: 'type', header: 'Form type', accessorFn: (r) => typeName(r.formType), meta: { label: 'Form' } },
      {
        id: 'range',
        header: 'Series',
        accessorFn: (r) => r.start,
        cell: ({ row }) => (
          <span className="num whitespace-nowrap text-[13px]">
            {pad(row.original.start)}–{pad(row.original.end)}
          </span>
        ),
        meta: { primary: true, label: 'Series' },
      },
      { id: 'to', header: 'Issued to', accessorFn: (r) => r.issuedToName ?? '', cell: ({ row }) => row.original.issuedToName ?? <span className="text-ink-subtle">Treasury vault</span>, meta: { label: 'Issued to' } },
      { id: 'on', header: 'Issued on', accessorFn: (r) => r.issuedOn ?? '', cell: ({ row }) => (row.original.issuedOn ? formatDate(row.original.issuedOn) : '—'), meta: { label: 'Issued on' } },
      { id: 'used', header: 'Used', accessorFn: (r) => r.usedCount, cell: ({ row }) => <span className="num">{formatCount(row.original.usedCount)}</span>, meta: { align: 'right', label: 'Used' } },
      { id: 'remaining', header: 'Remaining', accessorFn: (r) => r.remaining, cell: ({ row }) => <span className="num">{formatCount(row.original.remaining)}</span>, meta: { align: 'right', label: 'Remaining' } },
      { id: 'last', header: 'Last used', accessorFn: (r) => r.lastUsed ?? 0, cell: ({ row }) => <span className="num text-[13px]">{pad(row.original.lastUsed)}</span>, meta: { label: 'Last used' } },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.status,
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            <StatusBadge kind="series" value={row.original.status} />
            {row.original.missingSerials.length && row.original.status !== 'missing' ? <span className="text-xs text-money-short">{row.original.missingSerials.length} missing</span> : null}
          </span>
        ),
        meta: { label: 'Status' },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) =>
          can('forms.manage') && row.original.status === 'issued' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for series ${pad(row.original.start)}`} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => returnSeries.mutate(row.original.id, { onSuccess: () => toast.success('Unused forms returned to the Treasury.') })}>
                  <Undo2Icon /> Return unused
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => setMissing(row.original)}>
                  <PackageXIcon /> Report missing
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null,
        meta: { hideOnCard: true, label: 'Actions' },
      },
    ],
    [can, returnSeries, typeName],
  )

  return (
    <>
      <PageHeader
        title={t.pages.forms.title}
        description={t.pages.forms.description}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/accountable-forms/summary">
                <FileTextIcon /> Accountability summary
              </Link>
            </Button>
            {can('forms.manage') ? (
              <Button onClick={() => setIssueOpen(true)}>
                <FilePlus2Icon /> Issue series
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Skipped, duplicated, out-of-order and missing serials found in collectors&apos; records.</CardDescription>
          </div>
        </CardHeader>
        {alerts.data?.length ? (
          <ul className="divide-y divide-border">
            {alerts.data.map((a) => (
              <AlertRow key={a.id} a={a} />
            ))}
          </ul>
        ) : (
          <EmptyState compact title="No alerts" description="All serials are accounted for." />
        )}
      </Card>

      <DataTable
        data={series.data}
        isLoading={series.isLoading}
        isError={series.isError}
        onRetry={() => series.refetch()}
        columns={columns}
        getRowId={(r) => r.id}
        caption="Accountable form series"
        toolbar={
          <>
            <NativeSelect aria-label="Form type" value={formType} onChange={(e) => setFormType(e.target.value)} className="h-8 w-44">
              <option value="all">All form types</option>
              {types.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.shortName}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Collector" value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className="h-8 w-44">
              <option value="all">All holders</option>
              {collectors.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as SeriesStatus | 'all')} className="h-8 w-36">
              <option value="all">All statuses</option>
              {(['issued', 'in_stock', 'exhausted', 'returned', 'missing'] as const).map((s) => (
                <option key={s} value={s}>
                  {t.seriesStatus[s]}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />

      <IssueDialog open={issueOpen} onOpenChange={setIssueOpen} />
      <ReasonDialog
        open={Boolean(missing)}
        onOpenChange={(o) => !o && setMissing(null)}
        title="Report forms missing"
        description={missing ? `Series ${pad(missing.start)}–${pad(missing.end)} held by ${missing.issuedToName}. All unused forms from the next serial to the end of the series will be declared missing and cancelled.` : undefined}
        confirmLabel="Report missing"
        tone="danger"
        minLength={10}
        pending={reportMissing.isPending}
        onConfirm={(reason) => {
          if (!missing) return
          reportMissing.mutate(
            { id: missing.id, from: (missing.lastUsed ?? missing.start - 1) + 1, to: missing.end, reason },
            {
              onSuccess: () => {
                toast.success('Missing forms reported and cancelled.')
                setMissing(null)
              },
            },
          )
        }}
      />
    </>
  )
}

function AlertRow({ a }: { a: FormAlert }) {
  const Icon = a.kind === 'duplicate' ? CopyIcon : a.kind === 'out_of_order' ? ArrowDownUpIcon : a.kind === 'missing' ? PackageXIcon : AlertTriangleIcon
  const label = { gap: 'Skipped serial', duplicate: 'Duplicate serial', out_of_order: 'Used out of order', missing: 'Reported missing' }[a.kind]
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
      <Icon className="mt-0.5 size-4 shrink-0 text-money-short" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {label}: <span className="num">{a.formType === 'af51' ? 'OR' : 'CT'} {a.serial}</span>
        </p>
        <p className="text-[13px] text-ink-muted">
          {a.collectorName} · {formatDate(a.date)} · {a.note}
        </p>
      </div>
      {a.kind !== 'missing' ? (
        <Link href={`/app/reconciliation?date=${a.date}`} className="text-[13px] text-primary hover:underline">
          Open day →
        </Link>
      ) : null}
    </li>
  )
}

function IssueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { today } = useAppContext()
  const types = useFormTypes()
  const collectors = useCollectors('all', today)
  const stock = useFormSeries({ status: 'in_stock' })
  const issue = useIssueSeries()
  const [formType, setFormType] = React.useState('ct')
  const [collectorId, setCollectorId] = React.useState('')
  const [stockId, setStockId] = React.useState('')
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [issuedOn, setIssuedOn] = React.useState(today)
  const [error, setError] = React.useState<string | null>(null)
  const available = (stock.data ?? []).filter((s) => s.formType === formType)
  const pick = available.find((s) => s.id === stockId)
  const s0 = pick ? pick.start : Number(start)
  const e0 = pick ? pick.end : Number(end)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Issue accountable forms</DialogTitle>
          <DialogDescription>Hand a series of official receipts or cash tickets to a collector. The collector becomes accountable for every serial in the series.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!collectorId) return setError('Choose the collector.')
            if (!s0 || !e0 || e0 < s0) return setError('Choose a series in stock or enter a valid serial range.')
            setError(null)
            issue.mutate(
              { formType, start: s0, end: e0, collectorId, issuedOn },
              {
                onSuccess: (s) => {
                  toast.success(`Issued ${pad(s.start)}–${pad(s.end)} to ${s.issuedToName}.`)
                  onOpenChange(false)
                },
              },
            )
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Form type" htmlFor="is-type">
              <NativeSelect id="is-type" value={formType} onChange={(e) => { setFormType(e.target.value); setStockId('') }}>
                {types.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Collector" htmlFor="is-col">
              <NativeSelect id="is-col" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                <option value="">Choose…</option>
                {collectors.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.code})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Series in the vault" htmlFor="is-stock" hint={`${available.length} series in stock`}>
              <NativeSelect id="is-stock" value={stockId} onChange={(e) => setStockId(e.target.value)}>
                <option value="">Enter a range instead…</option>
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {pad(s.start)}–{pad(s.end)} ({s.end - s.start + 1} forms)
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Issued on" htmlFor="is-on">
              <Input id="is-on" type="date" max={today} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
            </Field>
            {!pick ? (
              <>
                <Field label="First serial" htmlFor="is-start">
                  <Input id="is-start" className="num" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value.replace(/\D/g, ''))} />
                </Field>
                <Field label="Last serial" htmlFor="is-end">
                  <Input id="is-end" className="num" inputMode="numeric" value={end} onChange={(e) => setEnd(e.target.value.replace(/\D/g, ''))} />
                </Field>
              </>
            ) : null}
          </div>
          {s0 && e0 && e0 >= s0 ? (
            <p className="text-sm">
              {formatCount(e0 - s0 + 1)} forms · <span className="num">{pad(s0)}–{pad(e0)}</span>
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-money-short">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={issue.isPending}>
              {issue.isPending ? t.common.saving : 'Issue series'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

