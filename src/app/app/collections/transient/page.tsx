'use client'

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { BarsChart, ChartCard, MiniTable, SERIES } from '@/components/charts'
import { Amount, SerialNumber } from '@/components/finance/amount'
import { CollectionDrawer, CollectionTags } from '@/components/finance/collection-drawer'
import { KpiCard } from '@/components/finance/kpi-card'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { EmptyState, Notice } from '@/components/shared/states'
import { Input } from '@/components/ui/input'
import { useCollections, useTransientDays } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { addDays, formatDate, formatDayShort, formatTime, formatWeekday } from '@/lib/dates'
import { formatPeso, sumBy } from '@/lib/money'
import { formatCount } from '@/lib/utils'
import type { CollectionView } from '@/types'

export default function TransientPage() {
  return (
    <RoleGate permission="collections.view" page="transient vendor collections">
      <Transient />
    </RoleGate>
  )
}

function Transient() {
  const { market, date, today } = useAppContext()
  const [day, setDay] = React.useState(date)
  const [openId, setOpenId] = React.useState<string | null>(null)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(date)
  }, [date])
  const scope = market === 'pm' ? 'pm' : market
  const list = useCollections({ market: scope, from: day, to: day, type: 'transient_fee' })
  const days = useTransientDays(scope, addDays(day, -20), day)
  const rows = list.data ?? []
  const avg = days.data ? Math.round(sumBy(days.data, (d) => d.amount) / Math.max(1, days.data.length)) : 0
  const avgVendors = days.data ? sumBy(days.data, (d) => d.vendors) / Math.max(1, days.data.length) : 0

  const columns = React.useMemo<ColumnDef<CollectionView, unknown>[]>(
    () => [
      { id: 'time', header: 'Time', accessorFn: (r) => r.recordedAt, cell: ({ row }) => <span className="whitespace-nowrap">{formatTime(row.original.recordedAt)}</span>, meta: { label: 'Time' } },
      { id: 'vendor', header: 'Vendor', accessorFn: (r) => r.payerName, cell: ({ row }) => <span className="font-medium">{row.original.payerName}</span>, meta: { primary: true, label: 'Vendor' } },
      { id: 'goods', header: 'Goods · basis', accessorFn: (r) => r.transientGoods ?? '', cell: ({ getValue }) => <span className="text-[13px] text-ink-muted">{String(getValue())}</span>, meta: { label: 'Goods' } },
      { id: 'serial', header: 'Cash ticket', accessorFn: (r) => r.receiptSerial, cell: ({ row }) => <SerialNumber serial={row.original.receiptSerial} formType={row.original.formType} />, meta: { label: 'Ticket' } },
      { id: 'collector', header: 'Collector', accessorFn: (r) => r.collectorName, meta: { label: 'Collector' } },
      { id: 'amount', header: 'Fee', accessorFn: (r) => r.countedAmount, cell: ({ row }) => <Amount value={row.original.countedAmount} />, meta: { align: 'right', label: 'Fee', footer: (r) => <Amount value={sumBy(r, (x) => x.countedAmount)} /> } },
      { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: ({ row }) => <CollectionTags c={row.original} />, enableSorting: false, meta: { label: 'Status' } },
    ],
    [],
  )

  return (
    <>
      <PageHeader
        title={t.pages.transient.title}
        description={t.pages.transient.description}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Day</span>
            <Input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-40" />
          </label>
        }
      />
      {market === 'pm' ? (
        <Notice tone="info" className="mb-4">
          The Public Market has no transient sellers&apos; area. Switch the market to “All markets” or “Seafood Market”.
        </Notice>
      ) : null}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <KpiCard label={`Vendors on ${formatDayShort(day)}`} value={<span className="num text-[1.625rem] font-semibold">{formatCount(rows.length)}</span>} deltaLabel={`${avgVendors.toFixed(1)} a day over 3 weeks`} />
        <KpiCard label="Fees collected" value={<Amount value={sumBy(rows, (r) => r.countedAmount)} size="kpi" />} deltaLabel={`average ${formatPeso(avg)} a day`} />
        <KpiCard label="Average per vendor" value={<Amount value={rows.length ? Math.round(sumBy(rows, (r) => r.countedAmount) / rows.length) : 0} size="kpi" />} deltaLabel="Small basket ₱30 · tub ₱75 · bulk ₱150" />
      </div>
      <ChartCard
        className="mb-6"
        title="Transient fees by day"
        description="Last 21 days, ending on the selected day"
        table={<MiniTable head={['Day', 'Vendors', 'Fees']} rows={[...(days.data ?? [])].reverse().map((d) => [`${formatWeekday(d.date).slice(0, 3)} ${formatDate(d.date)}`, d.vendors, <Amount key={d.date} value={d.amount} />])} />}
      >
        <BarsChart data={(days.data ?? []).map((d) => ({ date: d.date, amount: d.amount }))} xKey="date" xFormatter={(v) => formatDayShort(v)} tooltipLabel={(v) => `${formatWeekday(v)}, ${formatDate(v)}`} series={[{ key: 'amount', label: 'Transient fees', color: SERIES[1] }]} height={220} ariaLabel="Bar chart of transient fees by day" />
      </ChartCard>
      <DataTable
        data={list.data}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        columns={columns}
        getRowId={(r) => r.id}
        caption={`Transient vendors on ${formatDate(day)}`}
        onRowClick={(r) => setOpenId(r.id)}
        initialSorting={[{ id: 'time', desc: false }]}
        empty={<EmptyState compact title="No transient vendors recorded" description="No transient fees were recorded on this day." />}
      />
      <p className="mt-3 text-[13px] text-ink-muted">{t.notices.marcisNoOr}</p>
      <CollectionDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
