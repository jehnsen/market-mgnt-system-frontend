'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { FilePlus2Icon, SearchIcon } from 'lucide-react'
import { Amount, StallCode } from '@/components/finance/amount'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState } from '@/components/shared/states'
import { Badge, StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Segmented, Tabs, TabsList, TabsTrigger } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { marketName } from '@/config/lgu'
import { useLeases } from '@/hooks/api'
import { t } from '@/i18n'
import type { LeaseTab } from '@/lib/api'
import { useAppContext } from '@/lib/app-context'
import { formatDate } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import type { LeaseView } from '@/types'

export default function LeasesPage() {
  return (
    <RoleGate permission="leases.view" page="leases">
      <React.Suspense>
        <LeasesContent />
      </React.Suspense>
    </RoleGate>
  )
}

const TABS: { value: LeaseTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
]

function LeasesContent() {
  const params = useSearchParams()
  const router = useRouter()
  const can = useCan()
  const { market } = useAppContext()
  const [tab, setTab] = React.useState<LeaseTab>((params.get('tab') as LeaseTab) ?? 'active')
  const [within, setWithin] = React.useState<'30' | '60' | '90'>('30')
  const [q, setQ] = React.useState('')
  const query = useLeases({ market, tab, withinDays: Number(within) as 30 | 60 | 90, q })

  const columns = React.useMemo<ColumnDef<LeaseView, unknown>[]>(() => {
    const cols: ColumnDef<LeaseView, unknown>[] = [
      { id: 'no', header: 'Lease', accessorFn: (r) => r.leaseNo, cell: ({ row }) => <Link href={`/app/leases/${row.original.id}`} className="num font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.leaseNo}</Link>, meta: { primary: true, label: 'Lease' } },
      { id: 'stall', header: 'Stall', accessorFn: (r) => r.stallCode, cell: ({ row }) => <StallCode code={row.original.stallCode} />, sortingFn: (a, b) => a.original.stallCode.localeCompare(b.original.stallCode, undefined, { numeric: true }), meta: { label: 'Stall' } },
      { id: 'market', header: 'Market · section', accessorFn: (r) => `${marketName(r.marketId, true)} · ${r.sectionName}`, cell: ({ getValue }) => <span className="text-ink-muted">{String(getValue())}</span>, meta: { label: 'Section' } },
      { id: 'lessee', header: 'Lessee', accessorFn: (r) => r.lesseeName, cell: ({ row }) => <Link href={`/app/lessees/${row.original.lesseeId}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{row.original.lesseeName}</Link>, meta: { label: 'Lessee' } },
      { id: 'start', header: 'Start', accessorFn: (r) => r.startDate, cell: ({ row }) => formatDate(row.original.startDate), meta: { label: 'Start' } },
      {
        id: 'end',
        header: tab === 'terminated' ? 'Terminated' : 'End',
        accessorFn: (r) => r.terminatedOn ?? r.endDate,
        cell: ({ row }) => formatDate(row.original.terminatedOn ?? row.original.endDate),
        meta: { label: 'End' },
      },
      { id: 'rate', header: 'Monthly rate', accessorFn: (r) => r.monthlyRate, cell: ({ row }) => <Amount value={row.original.monthlyRate} />, meta: { align: 'right', label: 'Rate', footer: (rows) => <Amount value={sumBy(rows, (r) => r.monthlyRate)} /> } },
      { id: 'balance', header: 'Balance', accessorFn: (r) => r.balance, cell: ({ row }) => <Amount value={row.original.balance} dashZero />, meta: { align: 'right', label: 'Balance', footer: (rows) => <Amount value={sumBy(rows, (r) => r.balance)} /> } },
    ]
    if (tab === 'expiring') {
      cols.splice(5, 0, {
        id: 'days',
        header: 'Ends in',
        accessorFn: (r) => r.daysToExpiry,
        cell: ({ row }) => <Badge tone={row.original.daysToExpiry <= 7 ? 'red' : row.original.daysToExpiry <= 30 ? 'orange' : 'amber'}>{row.original.daysToExpiry} days</Badge>,
        meta: { label: 'Ends in' },
      })
    }
    if (tab === 'terminated') {
      cols.push({ id: 'reason', header: 'Reason', accessorFn: (r) => r.terminationReason ?? '', cell: ({ getValue }) => <span className="line-clamp-2 max-w-72 text-[13px] text-ink-muted">{String(getValue())}</span>, enableSorting: false, meta: { label: 'Reason' } })
    }
    if (tab === 'active') {
      cols.push({ id: 'status', header: 'Status', accessorFn: (r) => r.daysToExpiry, cell: ({ row }) => <StatusBadge kind="lease" value={row.original.daysToExpiry <= 30 ? 'expiring' : 'active'} />, meta: { label: 'Status' } })
    }
    return cols
  }, [tab])

  return (
    <>
      <PageHeader
        title={t.pages.leases.title}
        description={t.pages.leases.description}
        actions={
          can('leases.manage') ? (
            <Button asChild>
              <Link href="/app/leases/new">
                <FilePlus2Icon /> New lease
              </Link>
            </Button>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as LeaseTab)} className="mb-4">
        <TabsList aria-label="Lease status">
          {TABS.map((x) => (
            <TabsTrigger key={x.value} value={x.value}>
              {x.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        data={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        columns={columns}
        getRowId={(r) => r.id}
        caption={`${TABS.find((x) => x.value === tab)?.label} leases`}
        onRowClick={(r) => router.push(`/app/leases/${r.id}`)}
        empty={<EmptyState compact title="No leases here" description={tab === 'expiring' ? `No active lease ends in the next ${within} days.` : undefined} />}
        toolbar={
          <>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lease no., stall or lessee" aria-label="Search leases" className="w-64 pl-8" />
            </span>
            {tab === 'expiring' ? (
              <Segmented
                size="sm"
                label="Expiring within"
                value={within}
                onChange={setWithin}
                options={[
                  { value: '30', label: '30 days' },
                  { value: '60', label: '60 days' },
                  { value: '90', label: '90 days' },
                ]}
              />
            ) : null}
          </>
        }
      />
    </>
  )
}
