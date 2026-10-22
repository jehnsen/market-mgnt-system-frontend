'use client'

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { formatDate } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import type { StatementLine } from '@/types'
import { Amount } from './amount'

/** Charges, payments and a running balance; the footer shows totals and the closing balance. */
export function LedgerTable({ lines, caption, isLoading }: { lines: StatementLine[] | undefined; caption: string; isLoading?: boolean }) {
  const columns = React.useMemo<ColumnDef<StatementLine, unknown>[]>(
    () => [
      { id: 'date', header: 'Date', accessorFn: (r) => r.date, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>, meta: { primary: true, label: 'Date' }, enableSorting: false },
      { id: 'description', header: 'Description', accessorFn: (r) => r.description, enableSorting: false, meta: { label: 'Description', cellClassName: 'min-w-56' } },
      { id: 'reference', header: 'Reference', accessorFn: (r) => r.reference, cell: ({ row }) => <span className="num text-[12.5px] text-ink-muted">{row.original.reference}</span>, enableSorting: false, meta: { label: 'Reference' } },
      {
        id: 'charge',
        header: 'Charges',
        accessorFn: (r) => r.charge,
        cell: ({ row }) => <Amount value={row.original.charge} dashZero />,
        enableSorting: false,
        meta: { align: 'right', label: 'Charges', footer: (rows) => <Amount value={sumBy(rows, (r) => r.charge)} /> },
      },
      {
        id: 'payment',
        header: 'Payments',
        accessorFn: (r) => r.payment,
        cell: ({ row }) => <Amount value={row.original.payment} dashZero className="text-money-in" />,
        enableSorting: false,
        meta: { align: 'right', label: 'Payments', footer: (rows) => <Amount value={sumBy(rows, (r) => r.payment)} className="text-money-in" /> },
      },
      {
        id: 'balance',
        header: 'Running balance',
        accessorFn: (r) => r.balance,
        cell: ({ row }) => <Amount value={row.original.balance} className="font-medium" />,
        enableSorting: false,
        meta: { align: 'right', label: 'Balance', footer: (rows) => <Amount value={rows.at(-1)?.balance ?? 0} className="font-semibold" /> },
      },
    ],
    [],
  )
  return <DataTable data={lines} columns={columns} getRowId={(r) => `${r.date}-${r.description}-${r.reference}-${r.balance}`} caption={caption} isLoading={isLoading} maxHeight="min(60vh, 560px)" footerLabel={<span className="text-ink-muted">Totals / closing balance</span>} />
}
