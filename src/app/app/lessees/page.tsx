'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckIcon, MinusIcon, SearchIcon, UserPlusIcon } from 'lucide-react'
import { Amount, StallCode } from '@/components/finance/amount'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import { Label } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { useLessees } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatMonth } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import { maskPhone } from '@/lib/utils'
import type { LesseeView } from '@/types'

export default function LesseesPage() {
  return (
    <RoleGate permission="lessees.view" page="the lessee registry">
      <LesseesContent />
    </RoleGate>
  )
}

function LesseesContent() {
  const { market } = useAppContext()
  const router = useRouter()
  const can = useCan()
  const [q, setQ] = React.useState('')
  const [withBalance, setWithBalance] = React.useState(false)
  const query = useLessees({ market, q, withBalance })
  const showContact = can('lessees.viewContact')

  const columns = React.useMemo<ColumnDef<LesseeView, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (r) => `${r.lastName}, ${r.firstName}`,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/app/lessees/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
              {row.original.fullName}
            </Link>
            {row.original.businessName ? <p className="truncate text-xs text-ink-muted">{row.original.businessName}</p> : null}
          </div>
        ),
        meta: { primary: true, label: 'Name' },
      },
      {
        id: 'stalls',
        header: 'Stalls held',
        accessorFn: (r) => r.stallCodes.join(' '),
        cell: ({ row }) => (row.original.stallCodes.length ? <span className="flex flex-wrap gap-1">{row.original.stallCodes.map((c) => <StallCode key={c} code={c} />)}</span> : <span className="text-ink-subtle">None</span>),
        meta: { label: 'Stalls' },
      },
      {
        id: 'contact',
        header: 'Contact',
        accessorFn: (r) => r.contactNumber,
        cell: ({ row }) => <span className="num text-[13px]">{showContact ? row.original.contactNumber : maskPhone(row.original.contactNumber)}</span>,
        enableSorting: false,
        meta: { label: 'Contact' },
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorFn: (r) => r.balance,
        cell: ({ row }) => <Amount value={row.original.balance} dashZero />,
        meta: { align: 'right', label: 'Balance', footer: (rows) => <Amount value={sumBy(rows, (r) => Math.max(0, r.balance))} /> },
      },
      {
        id: 'oldest',
        header: 'Oldest unpaid',
        accessorFn: (r) => r.oldestUnpaidMonth ?? '9999',
        cell: ({ row }) => (row.original.oldestUnpaidMonth ? formatMonth(row.original.oldestUnpaidMonth) : <span className="text-ink-subtle">—</span>),
        meta: { label: 'Oldest unpaid' },
      },
      { id: 'lease', header: 'Lease status', accessorFn: (r) => r.leaseStatus, cell: ({ row }) => <StatusBadge kind="lease" value={row.original.leaseStatus} />, meta: { label: 'Lease' } },
      {
        id: 'sms',
        header: 'SMS opt-in',
        accessorFn: (r) => (r.smsConsent ? 1 : 0),
        cell: ({ row }) =>
          row.original.smsConsent ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-money-in">
              <CheckIcon className="size-3.5" aria-hidden /> Yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[13px] text-ink-muted">
              <MinusIcon className="size-3.5" aria-hidden /> No
            </span>
          ),
        meta: { label: 'SMS', align: 'center' },
      },
    ],
    [showContact],
  )

  return (
    <>
      <PageHeader
        title={t.pages.lessees.title}
        description={t.pages.lessees.description}
        actions={
          can('lessees.manage') ? (
            <Button asChild>
              <Link href="/app/lessees/new">
                <UserPlusIcon /> New lessee
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        data={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        columns={columns}
        getRowId={(r) => r.id}
        caption="Lessees"
        onRowClick={(r) => router.push(`/app/lessees/${r.id}`)}
        initialSorting={[{ id: 'name', desc: false }]}
        footerLabel={<span className="text-ink-muted">Total receivable · {query.data?.length ?? 0} lessees</span>}
        toolbar={
          <>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, business or stall code" aria-label="Search lessees" className="w-64 pl-8" />
            </span>
            <span className="flex items-center gap-2">
              <Checkbox id="with-balance" checked={withBalance} onCheckedChange={(v) => setWithBalance(Boolean(v))} />
              <Label htmlFor="with-balance" className="font-normal">
                With balance only
              </Label>
            </span>
            {!showContact ? <span className="text-xs text-ink-muted">Contact numbers are masked for your role.</span> : null}
          </>
        }
      />
    </>
  )
}
