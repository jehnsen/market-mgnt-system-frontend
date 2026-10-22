'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { FileTextIcon } from 'lucide-react'
import { BarsChart, ChartCard, MiniTable } from '@/components/charts'
import { AGING_COLOR, AGING_ORDER, AgingBar } from '@/components/finance/aging-bar'
import { Amount, StallCode } from '@/components/finance/amount'
import { BILLING_TABS, LinkTabs } from '@/components/layout/link-tabs'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { EmptyState } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { marketName } from '@/config/lgu'
import { useAgingBySection, useArrears, useSections } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatMonth } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import type { AgingBucket, ArrearsAccount } from '@/types'

export default function ArrearsPage() {
  return (
    <RoleGate permission="billing.view" page="arrears">
      <PageHeader title={t.pages.billing.title} description={t.pages.billing.description} documentTitle="Arrears aging" />
      <LinkTabs tabs={BILLING_TABS} label="Billing sections" />
      <Arrears />
    </RoleGate>
  )
}

function Arrears() {
  const { market } = useAppContext()
  const router = useRouter()
  const [sectionId, setSectionId] = React.useState('all')
  const [bucket, setBucket] = React.useState<AgingBucket | 'all' | 'overdue'>('all')
  const [selection, setSelection] = React.useState<RowSelectionState>({})
  const sections = useSections(market)
  const accounts = useArrears({ market, sectionId, bucket })
  const bySection = useAgingBySection(market)
  const totals = React.useMemo(() => {
    const b = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 } as Record<AgingBucket, number>
    for (const a of accounts.data ?? []) for (const k of AGING_ORDER) b[k] += a.buckets[k]
    return b
  }, [accounts.data])
  const selectedLessees = [...new Set((accounts.data ?? []).filter((a) => selection[a.leaseId]).map((a) => a.lesseeId))]

  const columns = React.useMemo<ColumnDef<ArrearsAccount, unknown>[]>(
    () => [
      {
        id: 'lessee',
        header: 'Lessee',
        accessorFn: (r) => r.lesseeName,
        cell: ({ row }) => (
          <Link href={`/app/lessees/${row.original.lesseeId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {row.original.lesseeName}
          </Link>
        ),
        meta: { primary: true, label: 'Lessee' },
      },
      { id: 'stall', header: 'Stall', accessorFn: (r) => r.stallCode, cell: ({ row }) => <StallCode code={row.original.stallCode} />, meta: { label: 'Stall' } },
      { id: 'section', header: 'Section', accessorFn: (r) => r.sectionName, cell: ({ row }) => <span className="whitespace-nowrap text-ink-muted">{marketName(row.original.marketId, true)} · {row.original.sectionName}</span>, meta: { label: 'Section' } },
      ...AGING_ORDER.map(
        (k): ColumnDef<ArrearsAccount, unknown> => ({
          id: k,
          header: t.aging[k],
          accessorFn: (r) => r.buckets[k],
          cell: ({ row }) => <Amount value={row.original.buckets[k]} dashZero className={k === 'd90_plus' && row.original.buckets[k] > 0 ? 'text-money-short' : undefined} />,
          meta: { align: 'right', label: t.aging[k], footer: (rows) => <Amount value={sumBy(rows, (r) => r.buckets[k])} /> },
        }),
      ),
      { id: 'balance', header: 'Balance', accessorFn: (r) => r.balance, cell: ({ row }) => <Amount value={row.original.balance} className="font-semibold" />, meta: { align: 'right', label: 'Balance', footer: (rows) => <Amount value={sumBy(rows, (r) => r.balance)} /> } },
      { id: 'oldest', header: 'Oldest unpaid', accessorFn: (r) => r.oldestUnpaidMonth ?? '', cell: ({ row }) => (row.original.oldestUnpaidMonth ? formatMonth(row.original.oldestUnpaidMonth) : '—'), meta: { label: 'Oldest unpaid' } },
      { id: 'notice', header: 'Last notice', accessorFn: (r) => r.lastNotice ?? '', cell: ({ row }) => (row.original.lastNotice ? <StatusBadge kind="notice" value={row.original.lastNotice} /> : <span className="text-ink-subtle">None</span>), meta: { label: 'Last notice' } },
    ],
    [],
  )

  const chartData = (bySection.data ?? []).map((s) => ({ name: s.sectionName, ...s.buckets }))
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ChartCard
          title="Arrears by section and age"
          description="Unpaid rentals and surcharges, after applying payments to the oldest charges first"
          table={<MiniTable head={['Section', ...AGING_ORDER.map((k) => t.aging[k]), 'Total']} rows={(bySection.data ?? []).map((s) => [s.sectionName, ...AGING_ORDER.map((k) => <Amount key={k} value={s.buckets[k]} />), <Amount key="t" value={s.total} />])} />}
        >
          <BarsChart data={chartData} xKey="name" layout="vertical" stacked height={Math.max(240, chartData.length * 38)} series={AGING_ORDER.map((k) => ({ key: k, label: t.aging[k], color: AGING_COLOR[k] }))} ariaLabel="Stacked bar chart of arrears by section and age" />
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle>Totals for the accounts shown</CardTitle>
          </CardHeader>
          <CardBody>
            <Amount value={sumBy(accounts.data ?? [], (a) => a.balance)} size="lg" />
            <p className="text-[13px] text-ink-muted">{accounts.data?.length ?? 0} accounts with a balance</p>
            <AgingBar buckets={totals} className="mt-4" />
          </CardBody>
        </Card>
      </div>

      <DataTable
        data={accounts.data}
        isLoading={accounts.isLoading}
        isError={accounts.isError}
        onRetry={() => accounts.refetch()}
        columns={columns}
        getRowId={(r) => r.leaseId}
        caption="Arrears by account"
        selection={{ value: selection, onChange: setSelection }}
        empty={<EmptyState compact title="No accounts in arrears" description="Nothing matches the filters." />}
        dense
        toolbar={
          <>
            <NativeSelect aria-label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="h-8 w-48">
              <option value="all">All sections</option>
              {sections.data
                ?.filter((s) => s.stallCount > 0)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </NativeSelect>
            <NativeSelect aria-label="Age" value={bucket} onChange={(e) => setBucket(e.target.value as AgingBucket | 'all' | 'overdue')} className="h-8 w-44">
              <option value="all">All balances</option>
              <option value="overdue">Overdue only</option>
              {AGING_ORDER.map((k) => (
                <option key={k} value={k}>
                  Has {t.aging[k].toLowerCase()}
                </option>
              ))}
            </NativeSelect>
            {selectedLessees.length ? (
              <Button size="sm" onClick={() => router.push(`/app/billing/statements/print?ids=${selectedLessees.join(',')}`)}>
                <FileTextIcon /> Statements for {selectedLessees.length} selected
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  )
}
