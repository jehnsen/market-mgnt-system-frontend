'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangleIcon, ArrowRightIcon, CloudOffIcon, LayoutGridIcon, ScaleIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react'
import { BarsChart, ChartCard, MiniTable, SERIES, TrendChart } from '@/components/charts'
import { AGING_ORDER, AgingBar } from '@/components/finance/aging-bar'
import { Amount, StallCode } from '@/components/finance/amount'
import { KpiCard } from '@/components/finance/kpi-card'
import { SyncIndicator } from '@/components/market/sync-indicator'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState, PageSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { lguConfig, marketName } from '@/config/lgu'
import { useDashboard, useSystemStatus, useAuditLog } from '@/hooks/api'
import { t } from '@/i18n'
import type { CollectorTodayRow, DashboardSummary } from '@/lib/api'
import { useAppContext } from '@/lib/app-context'
import { formatDate, formatDateTime, formatDayShort, formatMonth, formatMonthShort, formatWeekday, greeting } from '@/lib/dates'
import { formatPeso, sumBy } from '@/lib/money'
import { isSummaryRole, ROLE_LABEL } from '@/lib/permissions'
import { useSession } from '@/lib/session'
import { cn, formatCount } from '@/lib/utils'

function ratio(a: number, b: number) {
  return b === 0 ? null : (a - b) / b
}

export default function DashboardPage() {
  const { role, user } = useSession()
  const { market, date } = useAppContext()
  const [hello, setHello] = React.useState('Welcome')
  React.useEffect(() => {
    // Greeting depends on the viewer's clock, so compute it after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHello(greeting())
  }, [])
  const firstName = user?.name.replace(/^Hon\.\s*/, '').split(' ')[0] ?? ''
  const marketLabel = market === 'all' ? 'Public Market & Seafood Market' : marketName(market, true)

  if (role === 'admin') return <AdminDashboard name={firstName} hello={hello} />

  return (
    <>
      <PageHeader
        documentTitle={t.pages.dashboard.title}
        eyebrow={
          <span>
            {lguConfig.officeName} · <span className="font-medium text-ink">{marketLabel}</span>
          </span>
        }
        title={`${hello}, ${firstName}`}
        meta={
          <>
            <span className="text-sm text-ink-muted">
              {formatWeekday(date)}, {formatDate(date)}
            </span>
            {role ? <Badge tone="teal">{ROLE_LABEL[role]}</Badge> : null}
            {isSummaryRole(role) ? <Badge tone="slate">{t.common.readOnly}</Badge> : null}
          </>
        }
      />
      {isSummaryRole(role) ? <SummaryDashboard /> : <OperationalDashboard />}
    </>
  )
}

/* ------------------------------------------------------------ operational */

function OperationalDashboard() {
  const { market, date } = useAppContext()
  const q = useDashboard(date, market)
  if (q.isLoading && !q.data) return <PageSkeleton kpis={5} />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />
  const d = q.data
  return (
    <div className="grid gap-6">
      <KpiRow d={d} />
      <CollectorToday d={d} />
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionChart d={d} />
        <TrendCard d={d} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <AgingCard d={d} />
        <ExpiringCard d={d} />
        <AlertsCard d={d} />
      </div>
    </div>
  )
}

function KpiRow({ d }: { d: DashboardSummary }) {
  const monthPct = d.month.target ? (d.month.amount / d.month.target) * 100 : 0
  return (
    <section aria-label="Key figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        label={d.isToday ? 'Collected today' : `Collected ${formatDayShort(d.date)}`}
        value={<Amount value={d.collected.amount} size="kpi" />}
        delta={ratio(d.collected.amount, d.collected.compare)}
        deltaLabel={d.collected.compareLabel}
        spark={d.collected.spark}
        href="/app/collections"
      />
      <KpiCard
        label={`Collected in ${formatMonthShort(d.month.month)}`}
        value={<Amount value={d.month.amount} size="kpi" />}
        progress={{ value: monthPct, label: `${monthPct.toFixed(0)}% of ${formatPeso(d.month.target, { dropZeroCents: true })} target` }}
        spark={d.month.spark}
        href="/app/reports/monthly-collections"
      />
      <KpiCard
        label="Occupancy rate"
        value={<span className="num text-[1.625rem] leading-9 font-semibold 2xl:text-[1.875rem]">{(d.occupancy.rateBps / 100).toFixed(1)}%</span>}
        deltaLabel={`${formatCount(d.occupancy.occupied)} of ${formatCount(d.occupancy.total)} stalls occupied`}
        spark={d.occupancy.spark}
        href="/app/stalls"
      />
      <KpiCard
        label="Total arrears (overdue)"
        value={<Amount value={d.arrears.amount} size="kpi" />}
        deltaLabel={`${formatCount(d.arrears.accounts)} accounts past due`}
        tone={d.arrears.amount > 0 ? 'warning' : 'default'}
        href="/app/billing/arrears"
      />
      <KpiCard
        label="Open variances"
        value={<span className={cn('num text-[1.625rem] leading-9 font-semibold 2xl:text-[1.875rem]', d.variances.count > 0 && 'text-money-short')}>{d.variances.count}</span>}
        deltaLabel={d.variances.count ? <>Net <Amount value={d.variances.amount} size="sm" /> on days not yet closed</> : 'All remittances match'}
        tone={d.variances.count > 0 ? 'danger' : 'default'}
        href="/app/reconciliation"
      />
    </section>
  )
}

function CollectorToday({ d }: { d: DashboardSummary }) {
  const columns = React.useMemo<ColumnDef<CollectorTodayRow, unknown>[]>(
    () => [
      {
        id: 'collector',
        header: 'Collector',
        accessorFn: (r) => r.collectorName,
        cell: ({ row }) => (
          <Link href={`/app/collectors/${row.original.collectorId}`} className="font-medium hover:underline">
            {row.original.collectorName} <span className="num text-xs text-ink-muted">{row.original.code}</span>
          </Link>
        ),
        meta: { primary: true, label: 'Collector' },
      },
      { id: 'sections', header: 'Assigned section', accessorFn: (r) => r.sectionNames.join(', '), cell: ({ getValue }) => <span className="text-ink-muted">{String(getValue())}</span>, meta: { label: 'Section' } },
      { id: 'count', header: 'Collections', accessorFn: (r) => r.count, cell: ({ row }) => <span className="num">{formatCount(row.original.count)}</span>, meta: { align: 'right', label: 'Collections', footer: (rows) => <span className="num">{formatCount(sumBy(rows, (r) => r.count))}</span> } },
      { id: 'amount', header: 'Amount', accessorFn: (r) => r.amount, cell: ({ row }) => <Amount value={row.original.amount} />, meta: { align: 'right', label: 'Amount', footer: (rows) => <Amount value={sumBy(rows, (r) => r.amount)} /> } },
      {
        id: 'sync',
        header: 'Last sync',
        accessorFn: (r) => r.lastSyncAt ?? '',
        cell: ({ row }) => <SyncIndicator lastSyncAt={row.original.lastSyncAt} unsynced={row.original.unsyncedCount} />,
        meta: { label: 'Last sync' },
      },
      {
        id: 'remitted',
        header: 'Remitted',
        accessorFn: (r) => r.remitted,
        cell: ({ row }) => (row.original.hasRemittance ? <Amount value={row.original.remitted} /> : <span className="text-[13px] text-ink-muted">Not yet</span>),
        meta: { align: 'right', label: 'Remitted', footer: (rows) => <Amount value={sumBy(rows, (r) => r.remitted)} /> },
      },
      {
        id: 'variance',
        header: 'Variance',
        accessorFn: (r) => (r.hasRemittance ? r.variance : 0),
        cell: ({ row }) => (row.original.hasRemittance ? <Amount value={row.original.variance} signed positiveTone dashZero /> : <span className="text-ink-subtle">—</span>),
        meta: { align: 'right', label: 'Variance', footer: (rows) => <Amount value={sumBy(rows.filter((r) => r.hasRemittance), (r) => r.variance)} signed positiveTone /> },
      },
    ],
    [],
  )
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{d.isToday ? 'Today by collector' : `${formatDate(d.date)} by collector`}</CardTitle>
          <CardDescription>Amounts recorded in the field, sync status and what was remitted to the Treasury.</CardDescription>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/app/reconciliation">
            <ScaleIcon /> Reconcile
          </Link>
        </Button>
      </CardHeader>
      <DataTable data={d.byCollector} columns={columns} getRowId={(r) => r.collectorId} caption="Collections by collector" className="rounded-none border-0" maxHeight="none" />
    </Card>
  )
}

function SectionChart({ d }: { d: DashboardSummary }) {
  const rows = d.bySection.filter((s) => s.amount > 0 || s.name)
  const data = rows.map((s) => ({ name: d.bySection.length > 6 ? `${s.name}` : s.name, amount: s.amount, market: s.marketId }))
  return (
    <ChartCard
      title="Collections by section"
      description={`${d.isToday ? 'Today' : formatDate(d.date)} · ${formatPeso(sumBy(rows, (r) => r.amount))} total`}
      table={<MiniTable head={['Section', 'Market', 'Amount']} rows={rows.map((r) => [r.name, marketName(r.marketId, true), <Amount key={r.sectionId} value={r.amount} />])} />}
    >
      <BarsChart
        data={data}
        xKey="name"
        layout="vertical"
        height={Math.max(220, data.length * 34)}
        series={[{ key: 'amount', label: 'Collected', color: SERIES[0] }]}
        ariaLabel="Bar chart of collections by section"
      />
    </ChartCard>
  )
}

function TrendCard({ d }: { d: DashboardSummary }) {
  const data = d.trend.map((p) => ({ date: p.date, amount: p.amount }))
  const avg = Math.round(sumBy(d.trend, (p) => p.amount) / Math.max(1, d.trend.length))
  return (
    <ChartCard
      title="Last 30 days"
      description={`Daily collections · average ${formatPeso(avg)} a day`}
      table={<MiniTable head={['Date', 'Amount']} rows={[...d.trend].reverse().map((p) => [formatDate(p.date), <Amount key={p.date} value={p.amount} />])} />}
    >
      <TrendChart data={data} xKey="date" xFormatter={(v) => formatDayShort(v)} tooltipLabel={(v) => `${formatWeekday(v)}, ${formatDate(v)}`} series={[{ key: 'amount', label: 'Collected', color: SERIES[0] }]} ariaLabel="Line chart of daily collections for the last 30 days" />
    </ChartCard>
  )
}

function AgingCard({ d }: { d: DashboardSummary }) {
  const total = AGING_ORDER.reduce((s, k) => s + d.aging[k], 0)
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Arrears aging</CardTitle>
          <CardDescription>
            Unpaid rentals and surcharges · <Amount value={total} size="sm" /> outstanding
          </CardDescription>
        </div>
      </CardHeader>
      <CardBody>
        <AgingBar buckets={d.aging} />
        <Button asChild variant="link" className="mt-4">
          <Link href="/app/billing/arrears">
            View accounts <ArrowRightIcon />
          </Link>
        </Button>
      </CardBody>
    </Card>
  )
}

function ExpiringCard({ d }: { d: DashboardSummary }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Leases expiring in 30 days</CardTitle>
          <CardDescription>{d.expiring.length ? `${d.expiring.length} leases need renewal or turnover` : 'No leases end in the next 30 days'}</CardDescription>
        </div>
      </CardHeader>
      <ul className="max-h-72 divide-y divide-border overflow-y-auto">
        {d.expiring.map((l) => (
          <li key={l.id}>
            <Link href={`/app/leases/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-muted/60 sm:px-5">
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <StallCode code={l.stallCode} />
                  <span className="truncate text-sm font-medium">{l.lesseeName}</span>
                </span>
                <span className="text-xs text-ink-muted">Ends {formatDate(l.endDate)}</span>
              </span>
              <Badge tone={l.daysToExpiry <= 7 ? 'red' : 'orange'}>{l.daysToExpiry === 0 ? 'Today' : `${l.daysToExpiry} days`}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function AlertsCard({ d }: { d: DashboardSummary }) {
  const icon = { unsynced: CloudOffIcon, unreconciled: ScaleIcon, serial: AlertTriangleIcon, vacant: LayoutGridIcon }
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>{d.alerts.length ? `${d.alerts.length} items need attention` : 'Nothing needs attention'}</CardDescription>
        </div>
      </CardHeader>
      {d.alerts.length ? (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {d.alerts.map((a) => {
            const Icon = icon[a.kind]
            return (
              <li key={a.id}>
                <Link href={a.href} className="flex gap-3 px-4 py-2.5 hover:bg-surface-muted/60 sm:px-5">
                  <Icon className={cn('mt-0.5 size-4 shrink-0', a.severity === 'danger' ? 'text-money-short' : 'text-accent')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      <span className="sr-only">{a.severity === 'danger' ? 'Urgent: ' : 'Warning: '}</span>
                      {a.title}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">{a.detail}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <CardBody>
          <p className="flex items-center gap-2 text-sm text-money-in">
            <ShieldCheckIcon className="size-4" /> All clear.
          </p>
        </CardBody>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------------- summary */

function SummaryDashboard() {
  const { market, date } = useAppContext()
  const q = useDashboard(date, market)
  if (q.isLoading && !q.data) return <PageSkeleton kpis={4} />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />
  const d = q.data
  const yearTotal = sumBy(d.monthly, (m) => m.amount)
  return (
    <div className="grid gap-6">
      <section aria-label="Key figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`Collected in ${formatMonthShort(d.month.month)}`} value={<Amount value={d.month.amount} size="kpi" />} progress={{ value: d.month.target ? (d.month.amount / d.month.target) * 100 : 0, label: `of ${formatPeso(d.month.target, { dropZeroCents: true })} monthly target` }} spark={d.month.spark} />
        <KpiCard label="Last 12 months" value={<Amount value={yearTotal} size="kpi" />} deltaLabel={`${formatMonthShort(d.monthly[0]!.month)} – ${formatMonthShort(d.monthly.at(-1)!.month)}`} spark={d.monthly.map((m) => m.amount)} />
        <KpiCard label="Occupancy rate" value={<span className="num text-[1.625rem] leading-9 font-semibold 2xl:text-[1.875rem]">{(d.occupancy.rateBps / 100).toFixed(1)}%</span>} deltaLabel={`${d.occupancy.occupied} of ${d.occupancy.total} stalls`} spark={d.occupancy.spark} />
        <KpiCard label="Arrears (overdue)" value={<Amount value={d.arrears.amount} size="kpi" />} deltaLabel={`${d.arrears.accounts} accounts past due`} />
      </section>
      <ChartCard
        title="Monthly collections"
        description="Last 12 months, both markets as selected"
        table={<MiniTable head={['Month', 'Collections']} rows={d.monthly.map((m) => [formatMonth(m.month), <Amount key={m.month} value={m.amount} />])} />}
      >
        <BarsChart data={d.monthly.map((m) => ({ month: m.month, amount: m.amount }))} xKey="month" xFormatter={(v) => formatMonthShort(v).slice(0, 3)} tooltipLabel={(v) => formatMonth(v)} series={[{ key: 'amount', label: 'Collections', color: SERIES[0] }]} ariaLabel="Bar chart of monthly collections" />
      </ChartCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionChart d={d} />
        <AgingCard d={d} />
      </div>
      <p className="text-center text-sm text-ink-muted">
        Read-only view. Detailed figures are in{' '}
        <Link href="/app/reports" className="text-primary underline underline-offset-2">
          Reports
        </Link>
        .
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ admin */

function AdminDashboard({ name, hello }: { name: string; hello: string }) {
  const sys = useSystemStatus()
  const audit = useAuditLog('', 'all')
  const links = [
    { href: '/app/settings/users', label: 'Users & roles', icon: UsersIcon },
    { href: '/app/settings/markets', label: 'Markets & stall map', icon: LayoutGridIcon },
    { href: '/app/settings/fees', label: 'Fee schedule', icon: ScaleIcon },
    { href: '/app/settings/audit', label: 'Audit log', icon: ShieldCheckIcon },
  ]
  return (
    <>
      <PageHeader documentTitle={t.pages.dashboard.title} eyebrow={lguConfig.officeName} title={`${hello}, ${name}`} meta={<Badge tone="teal">{ROLE_LABEL.admin}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>System status</CardTitle>
          </CardHeader>
          <CardBody>
            {sys.data ? (
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Last backup</dt>
                  <dd>{formatDateTime(sys.data.lastBackupAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Storage used</dt>
                  <dd className="num">
                    {(sys.data.storageUsedMb / 1024).toFixed(1)} of {(sys.data.storageQuotaMb / 1024).toFixed(0)} GB
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Devices online</dt>
                  <dd className="num">
                    {sys.data.devicesOnline} of {sys.data.devicesTotal}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-ink-muted">{t.common.loading}</p>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Administration</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-2 sm:grid-cols-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-md border border-border px-3 py-3 hover:bg-surface-muted">
                <l.icon className="size-4 text-primary" aria-hidden /> <span className="font-medium">{l.label}</span>
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border">
            {audit.data?.slice(0, 8).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{a.actorName}</span> <span className="text-ink-muted">· {a.summary}</span>
                </span>
                <span className="text-xs text-ink-muted">{formatDateTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
