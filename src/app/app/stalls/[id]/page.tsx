'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { FilePlus2Icon, MessageSquareTextIcon, WrenchIcon } from 'lucide-react'
import { AgingBar } from '@/components/finance/aging-bar'
import { Amount, StallCode } from '@/components/finance/amount'
import { LedgerTable } from '@/components/finance/ledger-table'
import { StallStatusDialog } from '@/components/market/stall-panel'
import { DataTable } from '@/components/shared/data-table'
import { DetailList, DocumentList, Timeline } from '@/components/shared/detail'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls'
import { marketName } from '@/config/lgu'
import { useStall } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatDateTime, formatMonth } from '@/lib/dates'
import type { LeaseView } from '@/types'

export default function StallDetailPage() {
  return (
    <RoleGate permission="stalls.view" page="stall records">
      <StallDetail />
    </RoleGate>
  )
}

function StallDetail() {
  const { id } = useParams<{ id: string }>()
  const q = useStall(id)
  const can = useCan()
  const [statusOpen, setStatusOpen] = React.useState(false)
  if (q.isLoading) return <PageSkeleton />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} message={q.error instanceof Error ? q.error.message : undefined} />
  const d = q.data
  const s = d.stall

  return (
    <>
      <PageHeader
        documentTitle={`Stall ${s.code}`}
        eyebrow={`${marketName(s.marketId)} · ${s.sectionName}`}
        title={
          <span className="flex items-center gap-3">
            Stall <StallCode code={s.code} className="px-2 py-0.5 text-xl" />
          </span>
        }
        meta={
          <>
            <StatusBadge kind="stall" value={s.status} />
            {s.leaseExpiringSoon ? <StatusBadge kind="lease" value="expiring" /> : null}
            {s.inArrears ? <span className="rounded-md bg-money-short-soft px-2 py-0.5 text-xs font-medium text-money-short">{t.stallStatus.arrears}</span> : null}
          </>
        }
        actions={
          <>
            {can('leases.manage') && (s.status === 'vacant' || s.status === 'reserved') ? (
              <Button asChild>
                <Link href={`/app/leases/new?stall=${s.id}`}>
                  <FilePlus2Icon /> New lease
                </Link>
              </Button>
            ) : null}
            {can('messages.send') && s.lesseeId ? (
              <Button asChild variant="secondary">
                <Link href={`/app/messages?lessee=${s.lesseeId}`}>
                  <MessageSquareTextIcon /> Send reminder
                </Link>
              </Button>
            ) : null}
            {can('stalls.manage') && s.status !== 'occupied' ? (
              <Button variant="secondary" onClick={() => setStatusOpen(true)}>
                <WrenchIcon /> Record status
              </Button>
            ) : null}
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList aria-label="Stall record sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ledger">Payment ledger</TabsTrigger>
          <TabsTrigger value="leases">Lease history</TabsTrigger>
          <TabsTrigger value="history">Status history</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Stall and current lease</CardTitle>
            </CardHeader>
            <CardBody>
              <DetailList
                items={[
                  { label: 'Market', value: marketName(s.marketId) },
                  { label: 'Section', value: s.sectionName },
                  { label: 'Size and type', value: `${s.sizeSqm} m² · ${s.type}` },
                  { label: 'Floor plan position', value: <span className="num">Row {s.gridY + 1}, column {s.gridX + 1}</span> },
                  { label: 'Lessee', value: d.lease ? <Link className="text-primary hover:underline" href={`/app/lessees/${d.lease.lesseeId}`}>{d.lease.lesseeName}</Link> : '—' },
                  { label: 'Lease', value: d.lease ? <Link className="num text-primary hover:underline" href={`/app/leases/${d.lease.id}`}>{d.lease.leaseNo}</Link> : '—' },
                  { label: 'Lease period', value: d.lease ? `${formatDate(d.lease.startDate)} – ${formatDate(d.lease.endDate)}` : '—' },
                  { label: 'Monthly rate', value: d.lease ? <Amount value={d.lease.monthlyRate} /> : d.monthlyRateQuote ? <span><Amount value={d.monthlyRateQuote} /> <span className="text-xs text-ink-muted">current schedule</span></span> : '—' },
                  { label: 'Daily fee', value: d.dailyFee ? <Amount value={d.dailyFee} /> : '—' },
                  { label: 'Vacant since', value: s.status !== 'occupied' && s.vacantSince ? `${formatDate(s.vacantSince)}${s.daysVacant !== null ? ` (${s.daysVacant} days)` : ''}` : '—' },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Arrears</CardTitle>
            </CardHeader>
            <CardBody>
              {d.arrears ? (
                <>
                  <p className="text-sm text-ink-muted">Balance due</p>
                  <Amount value={d.arrears.balance} size="lg" className={d.arrears.daysOverdue > 0 ? 'text-money-short' : undefined} />
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {d.arrears.oldestUnpaidMonth ? `Oldest unpaid: ${formatMonth(d.arrears.oldestUnpaidMonth)}` : null}
                    {d.arrears.lastNotice ? ` · last notice: ${t.noticeLevel[d.arrears.lastNotice].toLowerCase()}` : ''}
                  </p>
                  <AgingBar buckets={d.arrears.buckets} className="mt-4" />
                </>
              ) : (
                <EmptyState compact title="No balance due" description="All billed rentals for this stall are paid." />
              )}
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          {d.lease ? (
            <LedgerTable lines={d.ledger} caption={`Payment ledger for stall ${s.code}`} />
          ) : (
            <EmptyState title="No current lease" description="The ledger shows charges and payments under the current lease." />
          )}
        </TabsContent>

        <TabsContent value="leases">
          <LeaseHistory leases={d.leaseHistory} />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardBody>
              <Timeline
                items={d.statusHistory.map((h) => ({
                  id: h.id,
                  title: (
                    <span className="flex flex-wrap items-center gap-2">
                      {h.from ? <StatusBadge kind="stall" value={h.from} /> : null}
                      <span aria-hidden>→</span>
                      <StatusBadge kind="stall" value={h.to} />
                    </span>
                  ),
                  meta: `${formatDateTime(h.at)} · ${h.byName}`,
                  body: h.note,
                }))}
              />
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentList documents={d.documents} />
        </TabsContent>
      </Tabs>
      <StallStatusDialog stall={s} open={statusOpen} onOpenChange={setStatusOpen} />
    </>
  )
}

function LeaseHistory({ leases }: { leases: LeaseView[] }) {
  const columns = React.useMemo<ColumnDef<LeaseView, unknown>[]>(
    () => [
      { id: 'no', header: 'Lease', accessorFn: (r) => r.leaseNo, cell: ({ row }) => <Link href={`/app/leases/${row.original.id}`} className="num font-medium text-primary hover:underline">{row.original.leaseNo}</Link>, meta: { primary: true, label: 'Lease' } },
      { id: 'lessee', header: 'Lessee', accessorFn: (r) => r.lesseeName, meta: { label: 'Lessee' } },
      { id: 'start', header: 'Start', accessorFn: (r) => r.startDate, cell: ({ row }) => formatDate(row.original.startDate), meta: { label: 'Start' } },
      { id: 'end', header: 'End', accessorFn: (r) => r.terminatedOn ?? r.endDate, cell: ({ row }) => formatDate(row.original.terminatedOn ?? row.original.endDate), meta: { label: 'End' } },
      { id: 'rate', header: 'Monthly rate', accessorFn: (r) => r.monthlyRate, cell: ({ row }) => <Amount value={row.original.monthlyRate} />, meta: { align: 'right', label: 'Rate' } },
      { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: ({ row }) => <StatusBadge kind="lease" value={row.original.status} />, meta: { label: 'Status' } },
    ],
    [],
  )
  return <DataTable data={leases} columns={columns} getRowId={(r) => r.id} caption="Lease history" empty={<EmptyState compact title="No leases on record" />} />
}
