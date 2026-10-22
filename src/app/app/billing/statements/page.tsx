'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { FileTextIcon, SearchIcon } from 'lucide-react'
import { Amount, StallCode } from '@/components/finance/amount'
import { BILLING_TABS, LinkTabs } from '@/components/layout/link-tabs'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import { Label } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { useLessees } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatMonth } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import type { LesseeView } from '@/types'

export default function StatementsPage() {
  return (
    <RoleGate permission="billing.view" page="statements of account">
      <PageHeader title={t.pages.billing.title} description={t.pages.billing.description} documentTitle="Statements of account" />
      <LinkTabs tabs={BILLING_TABS} label="Billing sections" />
      <Statements />
    </RoleGate>
  )
}

function Statements() {
  const { market } = useAppContext()
  const router = useRouter()
  const [q, setQ] = React.useState('')
  const [withBalance, setWithBalance] = React.useState(true)
  const [selection, setSelection] = React.useState<RowSelectionState>({})
  const lessees = useLessees({ market, q, withBalance })
  const ids = Object.keys(selection).filter((k) => selection[k])
  const columns = React.useMemo<ColumnDef<LesseeView, unknown>[]>(
    () => [
      { id: 'name', header: 'Lessee', accessorFn: (r) => `${r.lastName}, ${r.firstName}`, cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>, meta: { primary: true, label: 'Lessee' } },
      { id: 'stalls', header: 'Stalls', accessorFn: (r) => r.stallCodes.join(' '), cell: ({ row }) => <span className="flex flex-wrap gap-1">{row.original.stallCodes.map((c) => <StallCode key={c} code={c} />)}</span>, meta: { label: 'Stalls' } },
      { id: 'address', header: 'Address', accessorFn: (r) => r.address, cell: ({ getValue }) => <span className="text-[13px] text-ink-muted">{String(getValue())}</span>, meta: { label: 'Address' } },
      { id: 'oldest', header: 'Oldest unpaid', accessorFn: (r) => r.oldestUnpaidMonth ?? '', cell: ({ row }) => (row.original.oldestUnpaidMonth ? formatMonth(row.original.oldestUnpaidMonth) : '—'), meta: { label: 'Oldest unpaid' } },
      { id: 'balance', header: 'Balance', accessorFn: (r) => r.balance, cell: ({ row }) => <Amount value={row.original.balance} />, meta: { align: 'right', label: 'Balance', footer: (rows) => <Amount value={sumBy(rows, (r) => r.balance)} /> } },
    ],
    [],
  )
  return (
    <>
      <Notice tone="info" className="mb-4">
        Select one or more lessees, then preview their statements as official documents for printing. Each statement says “{t.notices.notOfficialReceipt}”
      </Notice>
      <DataTable
        data={lessees.data}
        isLoading={lessees.isLoading}
        isError={lessees.isError}
        onRetry={() => lessees.refetch()}
        columns={columns}
        getRowId={(r) => r.id}
        caption="Lessees for statements of account"
        selection={{ value: selection, onChange: setSelection }}
        initialSorting={[{ id: 'balance', desc: true }]}
        dense
        toolbar={
          <>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or stall" aria-label="Search lessees" className="h-8 w-56 pl-8" />
            </span>
            <span className="flex items-center gap-2">
              <Checkbox id="st-bal" checked={withBalance} onCheckedChange={(v) => setWithBalance(Boolean(v))} />
              <Label htmlFor="st-bal" className="font-normal">
                With balance only
              </Label>
            </span>
            <Button size="sm" disabled={ids.length === 0} onClick={() => router.push(`/app/billing/statements/print?ids=${ids.join(',')}`)}>
              <FileTextIcon /> Preview {ids.length ? `${ids.length} ` : ''}statement{ids.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      />
    </>
  )
}
