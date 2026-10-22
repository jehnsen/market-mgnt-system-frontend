'use client'

import * as React from 'react'
import {
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, Columns3Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menus'
import { NativeSelect } from '@/components/ui/input'
import { useIsDesktop } from '@/hooks/use-media-query'
import { t } from '@/i18n'
import { cn, formatCount } from '@/lib/utils'
import { EmptyState, ErrorState, TableSkeleton } from './states'

export interface ColumnMetaExt<T> {
  align?: 'left' | 'right' | 'center'
  /** Footer cell content computed from all rows currently in the table. */
  footer?: (rows: T[]) => React.ReactNode
  /** Title cell in phone card mode. */
  primary?: boolean
  /** Leave out of phone card mode. */
  hideOnCard?: boolean
  headerClassName?: string
  cellClassName?: string
  label?: string
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface ColumnMeta<TData, TValue> extends ColumnMetaExt<TData> {}
}

export interface DataTableProps<T> {
  data: T[] | undefined
  columns: ColumnDef<T, unknown>[]
  getRowId: (row: T) => string
  caption: string
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  toolbar?: React.ReactNode
  empty?: React.ReactNode
  initialSorting?: SortingState
  initialHidden?: string[]
  /** Paginate when there is no totals footer and rows exceed this size. */
  pageSize?: number
  /** Switch to a virtualized scroll body above this many rows. */
  virtualizeAbove?: number
  maxHeight?: string
  selection?: { value: RowSelectionState; onChange: (v: RowSelectionState) => void; canSelect?: (row: T) => boolean }
  footerLabel?: React.ReactNode
  dense?: boolean
  className?: string
}

const ROW_HEIGHT = 44

export function DataTable<T>({
  data,
  columns: inputColumns,
  getRowId,
  caption,
  isLoading,
  isError,
  onRetry,
  onRowClick,
  rowClassName,
  toolbar,
  empty,
  initialSorting = [],
  initialHidden = [],
  pageSize = 25,
  virtualizeAbove = 500,
  maxHeight,
  selection,
  footerLabel,
  dense,
  className,
}: DataTableProps<T>) {
  const isDesktop = useIsDesktop()
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [visibility, setVisibility] = React.useState<VisibilityState>(() => Object.fromEntries(initialHidden.map((id) => [id, false])))
  const [cardLimit, setCardLimit] = React.useState(40)

  const hasFooter = inputColumns.some((c) => c.meta?.footer)
  const rowsCount = data?.length ?? 0
  const virtual = rowsCount > virtualizeAbove
  const paginate = !hasFooter && !virtual && rowsCount > pageSize

  const columns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selection) return inputColumns
    const select: ColumnDef<T, unknown> = {
      id: '__select',
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows"
          checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? 'indeterminate' : false}
          onCheckedChange={(v) => table.toggleAllRowsSelected(Boolean(v))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      meta: { hideOnCard: true, headerClassName: 'w-10', cellClassName: 'w-10' },
    }
    return [select, ...inputColumns]
  }, [inputColumns, selection])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data ?? [],
    columns,
    getRowId,
    state: { sorting, columnVisibility: visibility, rowSelection: selection?.value ?? {} },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: (updater) => {
      if (!selection) return
      selection.onChange(typeof updater === 'function' ? updater(selection.value) : updater)
    },
    enableRowSelection: selection ? (row) => (selection.canSelect ? selection.canSelect(row.original) : true) : false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: paginate ? getPaginationRowModel() : undefined,
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  })

  const allRows = table.getSortedRowModel().rows
  const rows = paginate ? table.getRowModel().rows : allRows
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: virtual && isDesktop ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  if (isLoading && !data) return <TableSkeleton className={className} />
  if (isError && !data) return <ErrorState onRetry={onRetry} className={cn('rounded-lg border border-border bg-surface', className)} />

  const visibleCols = table.getVisibleLeafColumns()
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide())
  const footerRows = allRows.map((r) => r.original)

  const toolbarEl = (
    <div className="no-print flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
      {isDesktop && hideable.length > 3 && toolbar ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Show or hide columns">
              <Columns3Icon /> <span className="hidden lg:inline">{t.common.columns}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideable.map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(Boolean(v))} onSelect={(e) => e.preventDefault()}>
                {c.columnDef.meta?.label ?? (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )

  const isEmpty = rows.length === 0
  const emptyEl = empty ?? <EmptyState compact title={t.common.noResults} />

  /* ------------------------------------------------------------ phone */
  if (!isDesktop) {
    const shown = rows.slice(0, cardLimit)
    return (
      <div className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
        {toolbar ? toolbarEl : null}
        {isEmpty ? (
          emptyEl
        ) : (
          <ul className="divide-y divide-border" aria-label={caption}>
            {shown.map((row) => (
              <MobileCard key={row.id} row={row} onClick={onRowClick} className={rowClassName?.(row.original)} />
            ))}
          </ul>
        )}
        {rows.length > cardLimit ? (
          <div className="border-t border-border p-3 text-center">
            <Button variant="secondary" size="sm" onClick={() => setCardLimit((n) => n + 40)}>
              Show more ({formatCount(rows.length - cardLimit)} left)
            </Button>
          </div>
        ) : null}
        {hasFooter && !isEmpty ? (
          <dl className="grid gap-1 border-t-2 border-border bg-surface-muted px-4 py-3 text-sm">
            <div className="flex justify-between font-medium">
              <dt>{footerLabel ?? t.common.totals}</dt>
              <dd className="text-ink-muted">{formatCount(rows.length)} rows</dd>
            </div>
            {visibleCols
              .filter((c) => c.columnDef.meta?.footer)
              .map((c) => (
                <div key={c.id} className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{c.columnDef.meta?.label ?? (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id)}</dt>
                  <dd className="text-right">{c.columnDef.meta?.footer?.(footerRows)}</dd>
                </div>
              ))}
          </dl>
        ) : null}
      </div>
    )
  }

  /* ----------------------------------------------------------- desktop */
  const scrollable = virtual || Boolean(maxHeight) || hasFooter
  const vItems = virtual ? virtualizer.getVirtualItems() : []
  const padTop = virtual && vItems.length ? vItems[0]!.start : 0
  const padBottom = virtual && vItems.length ? virtualizer.getTotalSize() - vItems[vItems.length - 1]!.end : 0
  const renderRows = virtual ? vItems.map((v) => rows[v.index]!) : rows
  const cellPad = dense ? 'px-3 py-2' : 'px-3 py-2.5'

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
      {toolbar ? toolbarEl : null}
      <div
        ref={scrollRef}
        className={cn('relative overflow-x-auto', scrollable && 'overflow-y-auto')}
        style={scrollable ? { maxHeight: maxHeight ?? 'min(70vh, 760px)' } : undefined}
        tabIndex={scrollable ? 0 : undefined}
        aria-label={scrollable ? `${caption} (scrollable)` : undefined}
      >
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            {caption}
            {virtual ? ` — ${formatCount(rows.length)} rows, scroll to see more` : ''}
          </caption>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta
                  const sorted = h.column.getIsSorted()
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={cn(
                        'sticky top-0 z-10 border-b border-border bg-surface-muted text-left text-xs font-semibold tracking-wide whitespace-nowrap text-ink-muted',
                        cellPad,
                        meta?.align === 'right' && 'text-right',
                        meta?.align === 'center' && 'text-center',
                        meta?.headerClassName,
                      )}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn('inline-flex items-center gap-1 hover:text-ink', meta?.align === 'right' && 'flex-row-reverse')}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUpIcon className="size-3" /> : sorted === 'desc' ? <ArrowDownIcon className="size-3" /> : <ArrowUpDownIcon className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={visibleCols.length}>{emptyEl}</td>
              </tr>
            ) : null}
            {padTop > 0 ? (
              <tr aria-hidden>
                <td colSpan={visibleCols.length} style={{ height: padTop }} />
              </tr>
            ) : null}
            {renderRows.map((row) => (
              <tr
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row.original)
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                style={virtual ? { height: ROW_HEIGHT } : undefined}
                className={cn(
                  'group transition-colors data-[state=selected]:bg-primary-soft/60',
                  onRowClick && 'cursor-pointer hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60',
                  rowClassName?.(row.original),
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'border-b border-border align-middle',
                        cellPad,
                        meta?.align === 'right' && 'text-right',
                        meta?.align === 'center' && 'text-center',
                        meta?.cellClassName,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
            {padBottom > 0 ? (
              <tr aria-hidden>
                <td colSpan={visibleCols.length} style={{ height: padBottom }} />
              </tr>
            ) : null}
          </tbody>
          {hasFooter && !isEmpty ? (
            <tfoot>
              <tr>
                {visibleCols.map((c, i) => {
                  const meta = c.columnDef.meta
                  return (
                    <td
                      key={c.id}
                      className={cn(
                        'sticky bottom-0 z-10 border-t-2 border-border-strong bg-surface-muted font-semibold whitespace-nowrap',
                        cellPad,
                        meta?.align === 'right' && 'text-right',
                      )}
                    >
                      {meta?.footer ? meta.footer(footerRows) : i === 0 ? (footerLabel ?? <span className="text-ink-muted">{t.common.totals} · {formatCount(rows.length)} rows</span>) : null}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {paginate ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px] text-ink-muted">
          <span>
            {formatCount(table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1)}–
            {formatCount(Math.min(rowsCount, (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize))} of {formatCount(rowsCount)}
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="hidden sm:inline">{t.common.rowsPerPage}</span>
              <NativeSelect className="h-8 w-20" value={table.getState().pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))}>
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <Button variant="secondary" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeftIcon />
            </Button>
            <Button variant="secondary" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MobileCard<T>({ row, onClick, className }: { row: Row<T>; onClick?: (row: T) => void; className?: string }) {
  const cells = row.getVisibleCells().filter((c) => !c.column.columnDef.meta?.hideOnCard)
  const primary = cells.find((c) => c.column.columnDef.meta?.primary) ?? cells[0]
  const rest = cells.filter((c) => c !== primary)
  const select = row.getVisibleCells().find((c) => c.column.id === '__select')
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 font-medium">{primary ? flexRender(primary.column.columnDef.cell, primary.getContext()) : null}</div>
        {select ? flexRender(select.column.columnDef.cell, select.getContext()) : null}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        {rest.map((c) => {
          const meta = c.column.columnDef.meta
          const label = meta?.label ?? (typeof c.column.columnDef.header === 'string' ? c.column.columnDef.header : c.column.id)
          return (
            <div key={c.id} className="min-w-0">
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="truncate">{flexRender(c.column.columnDef.cell, c.getContext())}</dd>
            </div>
          )
        })}
      </dl>
    </>
  )
  return (
    <li className={cn('px-4 py-3', className)}>
      {onClick ? (
        <div role="button" tabIndex={0} className="block w-full text-left" onClick={() => onClick(row.original)} onKeyDown={(e) => e.key === 'Enter' && onClick(row.original)}>
          {content}
        </div>
      ) : (
        content
      )}
    </li>
  )
}

/** Column helper for amount columns with a totals footer. */
export function sumFooter<T>(pick: (row: T) => number, render: (total: number) => React.ReactNode) {
  return (rows: T[]) => render(rows.reduce((s, r) => s + pick(r), 0))
}
