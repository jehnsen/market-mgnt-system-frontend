'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { CornerDownRightIcon, DownloadIcon, InfoIcon, SearchIcon, ShoppingBasketIcon } from 'lucide-react'
import { CollectionDrawer, CollectionTags } from '@/components/finance/collection-drawer'
import { Amount, SerialNumber, StallCode } from '@/components/finance/amount'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState, Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { marketName } from '@/config/lgu'
import { useCollections, useCollectors, useSections } from '@/hooks/api'
import { t } from '@/i18n'
import type { CollectionFilters } from '@/lib/api'
import { useAppContext } from '@/lib/app-context'
import { addDays, formatDate, formatDateTime, formatTime } from '@/lib/dates'
import { formatPeso, formatPesoPlain, sumBy } from '@/lib/money'
import { cn, downloadTextFile, formatCount, toCsv } from '@/lib/utils'
import type { CollectionStatus, CollectionType, CollectionView } from '@/types'

const TYPES: CollectionType[] = ['daily_fee', 'monthly_rental', 'transient_fee', 'penalty', 'other']

export default function CollectionsPage() {
  return (
    <RoleGate permission="collections.view" page="the collections ledger">
      <React.Suspense>
        <Ledger />
      </React.Suspense>
    </RoleGate>
  )
}

type Quick = 'none' | 'today' | 'unsynced' | 'variance' | 'corrected' | 'correction_pending'

function Ledger() {
  const params = useSearchParams()
  const { market, date, today } = useAppContext()
  const can = useCan()
  const [from, setFrom] = React.useState(params.get('from') ?? date)
  const [to, setTo] = React.useState(params.get('to') ?? date)
  const [collectorId, setCollectorId] = React.useState('all')
  const [sectionId, setSectionId] = React.useState('all')
  const [type, setType] = React.useState<CollectionType | 'all'>('all')
  const [status, setStatus] = React.useState<CollectionFilters['status']>((params.get('status') as CollectionFilters['status']) ?? 'all')
  const [serialFrom, setSerialFrom] = React.useState('')
  const [serialTo, setSerialTo] = React.useState('')
  const [q, setQ] = React.useState('')
  const [openId, setOpenId] = React.useState<string | null>(params.get('id'))

  // Follow the date context unless the user picked a range.
  const [touchedRange, setTouchedRange] = React.useState(Boolean(params.get('from')))
  React.useEffect(() => {
    if (touchedRange) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom(date)
    setTo(date)
  }, [date, touchedRange])

  const filters: CollectionFilters = { market, from: from <= to ? from : to, to: from <= to ? to : from, collectorId, sectionId, type, status, serialFrom: serialFrom.replace(/\D/g, '') || undefined, serialTo: serialTo.replace(/\D/g, '') || undefined, q }
  const query = useCollections(filters)
  const collectors = useCollectors(market, date)
  const sections = useSections(market)
  const rows = query.data

  const quick: Quick = status === 'pending_sync' ? 'unsynced' : status === 'variance' ? 'variance' : status === 'corrected' ? 'corrected' : status === 'correction_pending' ? 'correction_pending' : from === today && to === today ? 'today' : 'none'
  const applyQuick = (k: Quick) => {
    setTouchedRange(true)
    if (k === 'today') {
      setFrom(today)
      setTo(today)
      setStatus('all')
      return
    }
    const map: Record<string, CollectionFilters['status']> = { unsynced: 'pending_sync', variance: 'variance', corrected: 'corrected', correction_pending: 'correction_pending' }
    setStatus(map[k])
    if (k !== 'unsynced' && from === to) setFrom(addDays(today, -89))
    if (k === 'unsynced') {
      setFrom(today)
      setTo(today)
    } else setTo(today)
  }

  const byType = React.useMemo(() => TYPES.map((tp) => ({ type: tp, amount: sumBy((rows ?? []).filter((r) => r.type === tp), (r) => r.countedAmount) })), [rows])
  const total = sumBy(rows ?? [], (r) => r.countedAmount)

  const columns = React.useMemo<ColumnDef<CollectionView, unknown>[]>(
    () => [
      {
        id: 'when',
        header: 'Date & time',
        accessorFn: (r) => r.recordedAt,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatDate(row.original.businessDate)} <span className="text-ink-muted">{formatTime(row.original.recordedAt)}</span>
          </span>
        ),
        meta: { label: 'Date & time' },
      },
      {
        id: 'payer',
        header: 'Stall / payer',
        accessorFn: (r) => r.stallCode ?? r.payerName,
        cell: ({ row }) => {
          const c = row.original
          if (c.correctsCollectionId)
            return (
              <span className="flex items-center gap-1.5 pl-2 text-[13px] text-ink-muted">
                <CornerDownRightIcon className="size-3.5" aria-hidden /> Correction of <span className="num">{c.receiptSerial}</span>
              </span>
            )
          return (
            <span className="flex min-w-0 items-center gap-2">
              {c.stallCode ? <StallCode code={c.stallCode} /> : <ShoppingBasketIcon className="size-4 shrink-0 text-ink-subtle" aria-label="Transient vendor" />}
              <span className="max-w-44 truncate">{c.payerName}</span>
            </span>
          )
        },
        meta: { primary: true, label: 'Stall / payer' },
      },
      { id: 'collector', header: 'Collector', accessorFn: (r) => r.collectorName, meta: { label: 'Collector' } },
      { id: 'market', header: 'Market', accessorFn: (r) => marketName(r.marketId, true), meta: { label: 'Market' } },
      { id: 'section', header: 'Section', accessorFn: (r) => r.sectionName, cell: ({ getValue }) => <span className="whitespace-nowrap text-ink-muted">{String(getValue())}</span>, meta: { label: 'Section' } },
      { id: 'type', header: 'Type', accessorFn: (r) => r.type, cell: ({ row }) => <span className="whitespace-nowrap">{t.collectionType[row.original.type]}</span>, meta: { label: 'Type' } },
      {
        id: 'serial',
        header: 'OR / ticket no.',
        accessorFn: (r) => r.receiptSerial,
        cell: ({ row }) => <SerialNumber serial={row.original.receiptSerial} formType={row.original.formType} className={row.original.isDuplicateSerial ? 'text-money-short' : undefined} />,
        meta: { label: 'Serial' },
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (r) => r.countedAmount,
        cell: ({ row }) => {
          const c = row.original
          if (c.correctsCollectionId && c.correctionStatus !== 'approved')
            return (
              <span className="text-right">
                <span className="num text-ink-subtle">—</span>
                <span className="block text-[11px] text-ink-muted">proposed {formatPeso(c.amount, { sign: 'always' })}</span>
              </span>
            )
          return <Amount value={c.countedAmount} signed={Boolean(c.correctsCollectionId)} />
        },
        meta: { align: 'right', label: 'Amount', footer: (r) => <Amount value={sumBy(r, (x) => x.countedAmount)} /> },
      },
      { id: 'recorded', header: 'Recorded offline at', accessorFn: (r) => r.recordedAt, cell: ({ row }) => <span className="whitespace-nowrap text-[13px] text-ink-muted">{formatTime(row.original.recordedAt)}</span>, meta: { label: 'Recorded' } },
      {
        id: 'synced',
        header: 'Synced at',
        accessorFn: (r) => r.syncedAt ?? '',
        cell: ({ row }) => (row.original.syncedAt ? <span className="whitespace-nowrap text-[13px] text-ink-muted">{formatTime(row.original.syncedAt)}</span> : <span className="text-[13px] font-medium text-accent-ink">On device</span>),
        meta: { label: 'Synced' },
      },
      { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: ({ row }) => <CollectionTags c={row.original} />, enableSorting: false, meta: { label: 'Status' } },
    ],
    [],
  )

  const exportCsv = () => {
    const head = ['Business date', 'Recorded at', 'Synced at', 'Collector', 'Market', 'Section', 'Stall', 'Payer', 'Type', 'Form', 'Serial', 'Amount counted', 'Status', 'Collection ID', 'Corrects']
    const body = (rows ?? []).map((r) => [r.businessDate, formatDateTime(r.recordedAt), r.syncedAt ? formatDateTime(r.syncedAt) : '', r.collectorName, marketName(r.marketId, true), r.sectionName, r.stallCode ?? '', r.payerName, t.collectionType[r.type], r.formType.toUpperCase(), r.receiptSerial, formatPesoPlain(r.countedAmount), r.status, r.id, r.correctsCollectionId ?? ''])
    body.push(['', '', '', '', '', '', '', '', '', '', 'TOTAL', formatPesoPlain(total), '', '', ''])
    downloadTextFile(`marcis-collections-${filters.from}_${filters.to}.csv`, toCsv([head, ...body]))
  }

  return (
    <>
      <PageHeader
        title={t.pages.collections.title}
        description={t.pages.collections.description}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/collections/transient">
                <ShoppingBasketIcon /> Transient vendors
              </Link>
            </Button>
            {can('reports.export') || can('collections.view') ? (
              <Button variant="secondary" onClick={exportCsv} disabled={!rows?.length}>
                <DownloadIcon /> Export CSV
              </Button>
            ) : null}
          </>
        }
      />

      <Notice tone="info" icon={<InfoIcon />} className="mb-4">
        <span id="no-or-note">{t.notices.marcisNoOr}</span> {t.notices.appendOnly}
      </Notice>

      <div className="no-print mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Quick filters">
        {(
          [
            ['today', 'Today'],
            ['unsynced', 'Unsynced'],
            ['variance', 'Variance'],
            ['corrected', 'Corrected'],
            ['correction_pending', 'Correction pending'],
          ] as [Quick, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={quick === k}
            onClick={() => applyQuick(k)}
            className={cn('h-8 rounded-full border px-3 text-[13px] font-medium transition-colors', quick === k ? 'border-primary bg-primary text-primary-ink' : 'border-border bg-surface text-ink hover:border-border-strong')}
          >
            {label}
          </button>
        ))}
      </div>

      <section aria-label="Totals by type for the rows shown" className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {byType.map((b) => (
          <div key={b.type} className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-xs text-ink-muted">{t.collectionType[b.type]}</p>
            <Amount value={b.amount} className="text-sm font-medium" />
          </div>
        ))}
        <div className="rounded-md border border-primary/40 bg-primary-soft px-3 py-2">
          <p className="text-xs font-medium text-ink">Total · {formatCount(rows?.length ?? 0)} rows</p>
          <Amount value={total} className="text-sm font-semibold" />
        </div>
      </section>

      <DataTable
        data={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        columns={columns}
        getRowId={(r) => r.id}
        caption={`Collections ledger. ${t.notices.marcisNoOr}`}
        onRowClick={(r) => setOpenId(r.id)}
        initialHidden={['market', 'recorded']}
        rowClassName={(r) => (r.correctsCollectionId ? 'bg-accent-soft/30' : r.status === 'pending_sync' ? 'bg-surface-muted/50' : undefined)}
        dense
        footerLabel={<span className="text-ink-muted">Totals · {formatCount(rows?.length ?? 0)} rows</span>}
        empty={<EmptyState compact title="No collections match" description="Widen the date range or clear some filters." />}
        toolbar={
          <>
            <label className="flex items-center gap-1.5 text-[13px]">
              <span className="text-ink-muted">From</span>
              <Input type="date" value={from} max={today} onChange={(e) => { setTouchedRange(true); setFrom(e.target.value) }} className="h-8 w-36" />
            </label>
            <label className="flex items-center gap-1.5 text-[13px]">
              <span className="text-ink-muted">to</span>
              <Input type="date" value={to} max={today} onChange={(e) => { setTouchedRange(true); setTo(e.target.value) }} className="h-8 w-36" />
            </label>
            <NativeSelect aria-label="Collector" value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className="h-8 w-40">
              <option value="all">All collectors</option>
              {collectors.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="h-8 w-40">
              <option value="all">All sections</option>
              {sections.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Type" value={type} onChange={(e) => setType(e.target.value as CollectionType | 'all')} className="h-8 w-36">
              <option value="all">All types</option>
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t.collectionType[tp]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as CollectionStatus | 'all')} className="h-8 w-36">
              <option value="all">All statuses</option>
              {(['pending_sync', 'synced', 'reconciled', 'variance', 'corrected'] as const).map((s) => (
                <option key={s} value={s}>
                  {t.collectionStatus[s]}
                </option>
              ))}
              <option value="correction_pending">Correction pending</option>
            </NativeSelect>
            <span className="flex items-center gap-1">
              <Input aria-label="Serial from" placeholder="Serial from" value={serialFrom} onChange={(e) => setSerialFrom(e.target.value)} className="num h-8 w-28" inputMode="numeric" />
              <span className="text-ink-muted">–</span>
              <Input aria-label="Serial to" placeholder="to" value={serialTo} onChange={(e) => setSerialTo(e.target.value)} className="num h-8 w-24" inputMode="numeric" />
            </span>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Payer, stall or serial" aria-label="Search collections" className="h-8 w-48 pl-8" />
            </span>
          </>
        }
      />
      <CollectionDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
