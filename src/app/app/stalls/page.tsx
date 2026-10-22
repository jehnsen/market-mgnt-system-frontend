'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { LayoutGridIcon, ListIcon, SearchIcon } from 'lucide-react'
import { Amount, StallCode } from '@/components/finance/amount'
import { StallLegend } from '@/components/market/stall-map'
import { StallPanel } from '@/components/market/stall-panel'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { ErrorState } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox, Segmented } from '@/components/ui/controls'
import { Label } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { marketName } from '@/config/lgu'
import { useMarkets, useSections, useStalls } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatDate } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import { formatCount } from '@/lib/utils'
import type { StallStatus, StallView } from '@/types'

const StallMap = dynamic(() => import('@/components/market/stall-map').then((m) => m.StallMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[460px] w-full" />,
})

export default function StallsPage() {
  return (
    <RoleGate permission="stalls.view" page="the stall map">
      <React.Suspense>
        <StallsContent />
      </React.Suspense>
    </RoleGate>
  )
}

function StallsContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { market } = useAppContext()
  const [view, setView] = React.useState<'map' | 'list'>(params.get('view') === 'list' ? 'list' : 'map')
  const [status, setStatus] = React.useState<StallStatus | 'all'>((params.get('status') as StallStatus) ?? 'all')
  const [sectionId, setSectionId] = React.useState('all')
  const [inArrears, setInArrears] = React.useState(params.get('arrears') === '1')
  const [expiring, setExpiring] = React.useState(params.get('expiring') === '1')
  const [q, setQ] = React.useState('')
  const [selected, setSelected] = React.useState<string | null>(params.get('stall'))

  const markets = useMarkets()
  const sections = useSections(market)
  const all = useStalls({ market })
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (all.data ?? []).filter(
      (s) =>
        (status === 'all' || s.status === status) &&
        (sectionId === 'all' || s.sectionId === sectionId) &&
        (!inArrears || s.inArrears) &&
        (!expiring || s.leaseExpiringSoon) &&
        (!needle || s.code.toLowerCase().includes(needle) || (s.lesseeName ?? '').toLowerCase().includes(needle)),
    )
  }, [all.data, status, sectionId, inArrears, expiring, q])
  const filtering = status !== 'all' || sectionId !== 'all' || inArrears || expiring || q.trim() !== ''
  const matches = React.useMemo(() => (filtering ? new Set(filtered.map((s) => s.id)) : null), [filtered, filtering])

  const counts = React.useMemo(() => {
    const list = all.data ?? []
    return { total: list.length, occupied: list.filter((s) => s.status === 'occupied').length, vacant: list.filter((s) => s.status === 'vacant').length }
  }, [all.data])

  const visibleMarkets = (markets.data ?? []).filter((m) => market === 'all' || m.id === market)

  return (
    <>
      <PageHeader
        title={t.pages.stalls.title}
        description={t.pages.stalls.description}
        meta={
          all.data ? (
            <span className="text-sm text-ink-muted">
              {formatCount(counts.total)} stalls · {formatCount(counts.occupied)} occupied · {formatCount(counts.vacant)} vacant
            </span>
          ) : null
        }
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'map', label: 'Map', icon: <LayoutGridIcon aria-hidden /> },
              { value: 'list', label: 'List', icon: <ListIcon aria-hidden /> },
            ]}
          />
        }
      />

      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-ink-muted">Status</span>
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as StallStatus | 'all')} className="w-40">
            <option value="all">All statuses</option>
            <option value="occupied">{t.stallStatus.occupied}</option>
            <option value="vacant">{t.stallStatus.vacant}</option>
            <option value="reserved">{t.stallStatus.reserved}</option>
            <option value="under_repair">{t.stallStatus.under_repair}</option>
          </NativeSelect>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-ink-muted">Section</span>
          <NativeSelect value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-52">
            <option value="all">All sections</option>
            {sections.data
              ?.filter((s) => s.stallCount > 0)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {market === 'all' ? `${marketName(s.marketId, true)} · ` : ''}
                  {s.name}
                </option>
              ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-ink-muted">Find</span>
          <span className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Stall code or lessee" className="w-52 pl-8" />
          </span>
        </label>
        <div className="flex h-9 items-center gap-2">
          <Checkbox id="f-arrears" checked={inArrears} onCheckedChange={(v) => setInArrears(Boolean(v))} />
          <Label htmlFor="f-arrears" className="font-normal">
            In arrears
          </Label>
        </div>
        <div className="flex h-9 items-center gap-2">
          <Checkbox id="f-expiring" checked={expiring} onCheckedChange={(v) => setExpiring(Boolean(v))} />
          <Label htmlFor="f-expiring" className="font-normal">
            Lease expiring
          </Label>
        </div>
        {filtering ? (
          <p className="ml-auto self-center text-[13px] text-ink-muted" aria-live="polite">
            {formatCount(filtered.length)} of {formatCount(counts.total)} stalls match
          </p>
        ) : null}
      </div>

      <StallLegend className="mb-4" />

      {all.isError ? (
        <ErrorState onRetry={() => all.refetch()} />
      ) : view === 'map' ? (
        <div className="grid gap-6">
          {visibleMarkets.map((m) => (
            <Card key={m.id}>
              <CardHeader>
                <div>
                  <CardTitle>{m.name}</CardTitle>
                  <CardDescription>
                    Drag to pan · Ctrl + scroll or the buttons to zoom · arrow keys to move between stalls
                  </CardDescription>
                </div>
              </CardHeader>
              <div className="p-2 sm:p-3">
                {all.data && sections.data ? (
                  <StallMap
                    market={m}
                    sections={sections.data.filter((s) => s.marketId === m.id)}
                    stalls={all.data.filter((s) => s.marketId === m.id)}
                    matches={matches}
                    selectedId={selected}
                    onSelect={(s) => setSelected(s.id)}
                    height={m.id === 'pm' ? 520 : 460}
                  />
                ) : (
                  <Skeleton className="h-[460px] w-full" />
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <StallList data={filtered} loading={all.isLoading} onOpen={(s) => router.push(`/app/stalls/${s.id}`)} />
      )}

      <StallPanel stallId={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function StallList({ data, loading, onOpen }: { data: StallView[]; loading: boolean; onOpen: (s: StallView) => void }) {
  const columns = React.useMemo<ColumnDef<StallView, unknown>[]>(
    () => [
      { id: 'code', header: 'Stall', accessorFn: (r) => r.code, cell: ({ row }) => <Link href={`/app/stalls/${row.original.id}`} onClick={(e) => e.stopPropagation()}><StallCode code={row.original.code} /></Link>, sortingFn: (a, b) => a.original.code.localeCompare(b.original.code, undefined, { numeric: true }), meta: { primary: true, label: 'Stall' } },
      { id: 'market', header: 'Market', accessorFn: (r) => marketName(r.marketId, true), meta: { label: 'Market' } },
      { id: 'section', header: 'Section', accessorFn: (r) => r.sectionName, meta: { label: 'Section' } },
      { id: 'size', header: 'Size', accessorFn: (r) => r.sizeSqm, cell: ({ row }) => <span className="num">{row.original.sizeSqm} m²</span>, meta: { align: 'right', label: 'Size' } },
      { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: ({ row }) => <StatusBadge kind="stall" value={row.original.status} />, meta: { label: 'Status' } },
      { id: 'lessee', header: 'Lessee', accessorFn: (r) => r.lesseeName ?? '', cell: ({ row }) => row.original.lesseeName ?? <span className="text-ink-subtle">—</span>, meta: { label: 'Lessee' } },
      { id: 'rate', header: 'Monthly rate', accessorFn: (r) => r.monthlyRate ?? 0, cell: ({ row }) => (row.original.monthlyRate ? <Amount value={row.original.monthlyRate} /> : <span className="text-ink-subtle">—</span>), meta: { align: 'right', label: 'Monthly rate', footer: (rows) => <Amount value={sumBy(rows, (r) => r.monthlyRate ?? 0)} /> } },
      { id: 'balance', header: 'Balance', accessorFn: (r) => r.balance, cell: ({ row }) => <Amount value={row.original.balance} dashZero className={row.original.inArrears ? 'font-semibold text-money-short' : undefined} />, meta: { align: 'right', label: 'Balance', footer: (rows) => <Amount value={sumBy(rows, (r) => r.balance)} /> } },
      { id: 'leaseEnd', header: 'Lease end', accessorFn: (r) => r.leaseEnd ?? '', cell: ({ row }) => (row.original.leaseEnd ? <span className={row.original.leaseExpiringSoon ? 'font-medium text-accent-ink' : undefined}>{formatDate(row.original.leaseEnd)}</span> : <span className="text-ink-subtle">—</span>), meta: { label: 'Lease end' } },
    ],
    [],
  )
  return <DataTable data={data} columns={columns} getRowId={(r) => r.id} caption="Stalls" isLoading={loading} onRowClick={onOpen} initialSorting={[{ id: 'code', desc: false }]} />
}
