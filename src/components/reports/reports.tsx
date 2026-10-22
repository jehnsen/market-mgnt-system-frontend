'use client'

import * as React from 'react'
import { BarsChart, ChartCard, MiniTable, SERIES, TrendChart } from '@/components/charts'
import { DocTable, DocumentPage } from '@/components/documents/document-page'
import { AGING_COLOR, AGING_ORDER, AgingBar } from '@/components/finance/aging-bar'
import { Amount, StallCode } from '@/components/finance/amount'
import { KpiCard } from '@/components/finance/kpi-card'
import { ErrorState, PageSkeleton } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { lguConfig, marketName } from '@/config/lgu'
import { useAgingBySection, useCollectorPerformance, useDailyReport, useMonthlySectionReport, useOccupancyReport, useSbSummary, useYearlyTrend } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatDate, formatMonth, formatMonthShort, monthKey } from '@/lib/dates'
import { formatPeso, formatPesoPlain, sumBy } from '@/lib/money'
import { cn, formatCount } from '@/lib/utils'
import type { CollectionType } from '@/types'
import { FilterField, ReportShell } from './report-shell'

const TYPES: CollectionType[] = ['daily_fee', 'monthly_rental', 'transient_fee', 'penalty', 'other']
const scopeLabel = (m: string) => (m === 'all' ? 'Public Market and Seafood Market' : marketName(m))
const pct = (a: number, b: number) => (b ? `${(((a - b) / b) * 100).toFixed(1)}%` : '—')

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn('sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left text-xs font-semibold whitespace-nowrap text-ink-muted', right && 'text-right')}>{children}</th>
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={cn('border-b border-border px-3 py-2', right && 'text-right', className)}>{children}</td>
}
function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </Card>
  )
}

function Loading({ q }: { q: { isLoading: boolean; isError: boolean; refetch: () => unknown } }) {
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />
  return <PageSkeleton />
}

/* ------------------------------------------------------------- daily */
export function DailyCollectionsReport() {
  const { market, date: ctxDate, today } = useAppContext()
  const [date, setDate] = React.useState(ctxDate)
  const q = useDailyReport(date, market)
  const rows = q.data?.rows ?? []
  const totals = TYPES.map((tp) => sumBy(rows, (r) => r.byType[tp]))
  return (
    <ReportShell
      title="Daily collection report"
      description={`${scopeLabel(market)} · ${formatDate(date)}`}
      fileName={`daily-collections-${date}`}
      filters={
        <FilterField label="Day">
          <Input type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
        </FilterField>
      }
      csv={() => [['Collector', ...TYPES.map((tp) => t.collectionType[tp]), 'Collections', 'Total', 'Remitted', 'Variance'], ...rows.map((r) => [r.collectorName, ...TYPES.map((tp) => formatPesoPlain(r.byType[tp])), r.count, formatPesoPlain(r.total), formatPesoPlain(r.remitted), formatPesoPlain(r.variance)]), ['TOTAL', ...totals.map(formatPesoPlain), sumBy(rows, (r) => r.count), formatPesoPlain(sumBy(rows, (r) => r.total)), formatPesoPlain(sumBy(rows, (r) => r.remitted)), formatPesoPlain(sumBy(rows, (r) => r.variance))]]}
      document={
        <DocumentPage title="Daily Collection Report" subtitle={`${scopeLabel(market)} · ${formatDate(date)}`} signatures={[{ role: 'Prepared by', title: 'Revenue Collection Clerk' }, { role: 'Noted', title: lguConfig.treasurerTitle }]} footnote={t.notices.marcisNoOr}>
          <DocTable className="text-[11.5px]">
            <thead>
              <tr>
                <th>Collector</th>
                {TYPES.map((tp) => (
                  <th key={tp} className="text-right">
                    {t.collectionType[tp]}
                  </th>
                ))}
                <th className="text-right">Total</th>
                <th className="text-right">Remitted</th>
                <th className="text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.collectorId}>
                  <td>{r.collectorName}</td>
                  {TYPES.map((tp) => (
                    <td key={tp} className="num text-right">
                      {formatPeso(r.byType[tp])}
                    </td>
                  ))}
                  <td className="num text-right font-semibold">{formatPeso(r.total)}</td>
                  <td className="num text-right">{formatPeso(r.remitted)}</td>
                  <td className="num text-right">{formatPeso(r.variance, { sign: 'always' })}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td>Total</td>
                {totals.map((v, i) => (
                  <td key={i} className="num text-right">
                    {formatPeso(v)}
                  </td>
                ))}
                <td className="num text-right">{formatPeso(sumBy(rows, (r) => r.total))}</td>
                <td className="num text-right">{formatPeso(sumBy(rows, (r) => r.remitted))}</td>
                <td className="num text-right">{formatPeso(sumBy(rows, (r) => r.variance), { sign: 'always' })}</td>
              </tr>
            </tbody>
          </DocTable>
        </DocumentPage>
      }
    >
      {!q.data ? (
        <Loading q={q} />
      ) : (
        <>
          <ChartCard title="By collector and type" description={`${formatPeso(sumBy(rows, (r) => r.total))} collected`}>
            <BarsChart data={rows.map((r) => ({ name: r.collectorName, ...r.byType }))} xKey="name" layout="vertical" stacked height={Math.max(220, rows.length * 44)} series={TYPES.map((tp, i) => ({ key: tp, label: t.collectionType[tp], color: SERIES[i]! }))} ariaLabel="Stacked bar chart of collections by collector and type" />
          </ChartCard>
          <TableCard title="Collections by collector">
            <thead>
              <tr>
                <Th>Collector</Th>
                {TYPES.map((tp) => (
                  <Th key={tp} right>
                    {t.collectionType[tp]}
                  </Th>
                ))}
                <Th right>Count</Th>
                <Th right>Total</Th>
                <Th right>Remitted</Th>
                <Th right>Variance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.collectorId}>
                  <Td className="font-medium">{r.collectorName}</Td>
                  {TYPES.map((tp) => (
                    <Td key={tp} right>
                      <Amount value={r.byType[tp]} dashZero />
                    </Td>
                  ))}
                  <Td right>
                    <span className="num">{r.count}</span>
                  </Td>
                  <Td right>
                    <Amount value={r.total} className="font-semibold" />
                  </Td>
                  <Td right>
                    <Amount value={r.remitted} dashZero />
                  </Td>
                  <Td right>
                    <Amount value={r.variance} signed positiveTone dashZero />
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-muted font-semibold">
              <tr>
                <Td>Totals</Td>
                {totals.map((v, i) => (
                  <Td key={i} right>
                    <Amount value={v} />
                  </Td>
                ))}
                <Td right>
                  <span className="num">{formatCount(sumBy(rows, (r) => r.count))}</span>
                </Td>
                <Td right>
                  <Amount value={sumBy(rows, (r) => r.total)} />
                </Td>
                <Td right>
                  <Amount value={sumBy(rows, (r) => r.remitted)} />
                </Td>
                <Td right>
                  <Amount value={sumBy(rows, (r) => r.variance)} signed positiveTone />
                </Td>
              </tr>
            </tfoot>
          </TableCard>
        </>
      )}
    </ReportShell>
  )
}

type MonthRow = { sectionId: string; sectionName: string; marketId: string; byType: Record<CollectionType, number>; total: number; previous: number }

function MCell({ doc, className, children }: { doc?: boolean; className?: string; children: React.ReactNode }) {
  return <td className={cn(!doc && 'border-b border-border px-3 py-2', className)}>{children}</td>
}

function MonthTable({ rows, total, prev, doc }: { rows: MonthRow[]; total: number; prev: number; doc?: boolean }) {
    return (
      <>
        <thead>
          <tr>
            {doc ? (
              <>
                <th>Section</th>
                {TYPES.map((tp) => (
                  <th key={tp} className="text-right">
                    {t.collectionType[tp]}
                  </th>
                ))}
                <th className="text-right">Total</th>
                <th className="text-right">Prev. month</th>
              </>
            ) : (
              <>
                <Th>Section</Th>
                {TYPES.map((tp) => (
                  <Th key={tp} right>
                    {t.collectionType[tp]}
                  </Th>
                ))}
                <Th right>Total</Th>
                <Th right>Previous month</Th>
                <Th right>Change</Th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sectionId}>
              <MCell doc={doc} className={doc ? undefined : 'font-medium'}>
                {r.sectionName} <span className="text-xs text-ink-muted">· {marketName(r.marketId, true)}</span>
              </MCell>
              {TYPES.map((tp) => (
                <MCell doc={doc} key={tp} className="num text-right">
                  {formatPeso(r.byType[tp])}
                </MCell>
              ))}
              <MCell doc={doc} className="num text-right font-semibold">{formatPeso(r.total)}</MCell>
              <MCell doc={doc} className="num text-right">{formatPeso(r.previous)}</MCell>
              {!doc ? <MCell doc={doc} className={cn('num text-right', r.total < r.previous && 'text-money-short')}>{pct(r.total, r.previous)}</MCell> : null}
            </tr>
          ))}
          <tr className="bg-surface-muted font-bold">
            <MCell doc={doc}>Total</MCell>
            {TYPES.map((tp) => (
              <MCell doc={doc} key={tp} className="num text-right">
                {formatPeso(sumBy(rows, (r) => r.byType[tp]))}
              </MCell>
            ))}
            <MCell doc={doc} className="num text-right">{formatPeso(total)}</MCell>
            <MCell doc={doc} className="num text-right">{formatPeso(prev)}</MCell>
            {!doc ? <MCell doc={doc} className="num text-right">{pct(total, prev)}</MCell> : null}
          </tr>
        </tbody>
      </>
    )
}

/* ----------------------------------------------------------- monthly */
export function MonthlyCollectionsReport() {
  const { market, today } = useAppContext()
  const [month, setMonth] = React.useState(monthKey(today))
  const q = useMonthlySectionReport(month, market)
  const rows = (q.data?.rows ?? []).filter((r) => r.total !== 0 || r.previous !== 0)
  const total = sumBy(rows, (r) => r.total)
  const prev = sumBy(rows, (r) => r.previous)
  return (
    <ReportShell
      title="Monthly collections by section"
      description={`${scopeLabel(market)} · ${formatMonth(month)}`}
      fileName={`monthly-collections-${month}`}
      filters={
        <FilterField label="Month">
          <Input type="month" max={monthKey(today)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />
        </FilterField>
      }
      csv={() => [['Market', 'Section', ...TYPES.map((tp) => t.collectionType[tp]), 'Total', 'Previous month'], ...rows.map((r) => [marketName(r.marketId, true), r.sectionName, ...TYPES.map((tp) => formatPesoPlain(r.byType[tp])), formatPesoPlain(r.total), formatPesoPlain(r.previous)]), ['', 'TOTAL', ...TYPES.map((tp) => formatPesoPlain(sumBy(rows, (r) => r.byType[tp]))), formatPesoPlain(total), formatPesoPlain(prev)]]}
      document={
        <DocumentPage title="Monthly Collections by Section" subtitle={`${scopeLabel(market)} · ${formatMonth(month)}`} signatures={[{ role: 'Prepared by', title: 'Revenue Collection Clerk' }, { role: 'Certified correct', title: lguConfig.treasurerTitle }]}>
          <DocTable className="text-[11px]">
            <MonthTable rows={rows} total={total} prev={prev} doc />
          </DocTable>
        </DocumentPage>
      }
    >
      {!q.data ? (
        <Loading q={q} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label={`Collected in ${formatMonthShort(month)}`} value={<Amount value={total} size="kpi" />} delta={prev ? (total - prev) / prev : null} deltaLabel="vs. previous month" />
            <KpiCard label="Largest section" value={<span className="font-heading text-xl font-semibold">{[...rows].sort((a, b) => b.total - a.total)[0]?.sectionName ?? '—'}</span>} deltaLabel={formatPeso([...rows].sort((a, b) => b.total - a.total)[0]?.total ?? 0)} />
            <KpiCard label="Monthly rentals collected" value={<Amount value={sumBy(rows, (r) => r.byType.monthly_rental)} size="kpi" />} deltaLabel={`${formatPeso(sumBy(rows, (r) => r.byType.daily_fee))} in daily fees`} />
          </div>
          <ChartCard title="By section" description="Stacked by collection type">
            <BarsChart data={rows.map((r) => ({ name: r.sectionName, ...r.byType }))} xKey="name" layout="vertical" stacked height={Math.max(260, rows.length * 38)} series={TYPES.map((tp, i) => ({ key: tp, label: t.collectionType[tp], color: SERIES[i]! }))} ariaLabel="Stacked bar chart of monthly collections by section" />
          </ChartCard>
          <TableCard title="Sections">
            <MonthTable rows={rows} total={total} prev={prev} />
          </TableCard>
          <p className="text-[13px] text-ink-muted">Months before the first synced day use totals migrated from the Treasury&apos;s earlier ledgers.</p>
        </>
      )}
    </ReportShell>
  )
}

/* ------------------------------------------------------- performance */
export function CollectorPerformanceReport() {
  const { market, today } = useAppContext()
  const [month, setMonth] = React.useState(monthKey(today))
  const q = useCollectorPerformance(month, market)
  const rows = q.data?.rows ?? []
  return (
    <ReportShell
      title="Collector performance"
      description={`${scopeLabel(market)} · ${formatMonth(month)}`}
      fileName={`collector-performance-${month}`}
      filters={
        <FilterField label="Month">
          <Input type="month" max={monthKey(today)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />
        </FilterField>
      }
      csv={() => [['Collector', 'Days', 'Collections', 'Amount', 'Shortage days', 'Shortage', 'Overage', 'Avg sync delay (min)'], ...rows.map((r) => [r.collectorName, r.days, r.collections, formatPesoPlain(r.amount), r.shortageDays, formatPesoPlain(r.shortage), formatPesoPlain(r.overage), r.avgSyncDelayMin])]}
      document={
        <DocumentPage title="Collector Performance" subtitle={`${scopeLabel(market)} · ${formatMonth(month)}`} signatures={[{ role: 'Prepared by', title: lguConfig.marketSupervisorTitle }, { role: 'Noted', title: lguConfig.treasurerTitle }]}>
          <DocTable>
            <thead>
              <tr>
                <th>Collector</th>
                <th className="text-right">Days</th>
                <th className="text-right">Collections</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Shortage days</th>
                <th className="text-right">Shortage</th>
                <th className="text-right">Avg sync delay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.collectorId}>
                  <td>{r.collectorName}</td>
                  <td className="num text-right">{r.days}</td>
                  <td className="num text-right">{r.collections}</td>
                  <td className="num text-right">{formatPeso(r.amount)}</td>
                  <td className="num text-right">{r.shortageDays}</td>
                  <td className="num text-right">{formatPeso(r.shortage)}</td>
                  <td className="num text-right">{r.avgSyncDelayMin} min</td>
                </tr>
              ))}
            </tbody>
          </DocTable>
        </DocumentPage>
      }
    >
      {!q.data ? (
        <Loading q={q} />
      ) : (
        <>
          <ChartCard title="Amount collected" description="Per collector this month" table={<MiniTable head={['Collector', 'Amount']} rows={rows.map((r) => [r.collectorName, <Amount key={r.collectorId} value={r.amount} />])} />}>
            <BarsChart data={rows.map((r) => ({ name: r.collectorName, amount: r.amount }))} xKey="name" layout="vertical" height={Math.max(220, rows.length * 40)} series={[{ key: 'amount', label: 'Collected', color: SERIES[0] }]} ariaLabel="Bar chart of collections per collector" />
          </ChartCard>
          <TableCard title="Performance">
            <thead>
              <tr>
                <Th>Collector</Th>
                <Th right>Days worked</Th>
                <Th right>Collections</Th>
                <Th right>Amount</Th>
                <Th right>Shortage days</Th>
                <Th right>Shortage</Th>
                <Th right>Overage</Th>
                <Th right>Avg sync delay</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.collectorId}>
                  <Td className="font-medium">{r.collectorName}</Td>
                  <Td right>
                    <span className="num">{r.days}</span>
                  </Td>
                  <Td right>
                    <span className="num">{formatCount(r.collections)}</span>
                  </Td>
                  <Td right>
                    <Amount value={r.amount} />
                  </Td>
                  <Td right>
                    <span className={cn('num', r.shortageDays > 0 && 'font-semibold text-money-short')}>{r.shortageDays}</span>
                  </Td>
                  <Td right>
                    <Amount value={r.shortage} dashZero />
                  </Td>
                  <Td right>
                    <Amount value={r.overage} positiveTone dashZero />
                  </Td>
                  <Td right>
                    <span className={cn('num', r.avgSyncDelayMin > 60 && 'text-accent-ink')}>{r.avgSyncDelayMin} min</span>
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-muted font-semibold">
              <tr>
                <Td>Totals</Td>
                <Td right>—</Td>
                <Td right>
                  <span className="num">{formatCount(sumBy(rows, (r) => r.collections))}</span>
                </Td>
                <Td right>
                  <Amount value={sumBy(rows, (r) => r.amount)} />
                </Td>
                <Td right>
                  <span className="num">{sumBy(rows, (r) => r.shortageDays)}</span>
                </Td>
                <Td right>
                  <Amount value={sumBy(rows, (r) => r.shortage)} />
                </Td>
                <Td right>
                  <Amount value={sumBy(rows, (r) => r.overage)} positiveTone />
                </Td>
                <Td right>—</Td>
              </tr>
            </tfoot>
          </TableCard>
        </>
      )}
    </ReportShell>
  )
}

/* --------------------------------------------------------- occupancy */
export function OccupancyReport() {
  const { market } = useAppContext()
  const q = useOccupancyReport(market)
  const d = q.data
  const rows = d?.bySection ?? []
  return (
    <ReportShell
      title="Occupancy and vacancy"
      description={scopeLabel(market)}
      fileName="occupancy"
      csv={() => [['Section', 'Market', 'Occupied', 'Vacant', 'Reserved', 'Under repair', 'Total', 'Occupancy %'], ...rows.map((r) => [r.sectionName, marketName(r.marketId, true), r.occupied, r.vacant, r.reserved, r.repair, r.total, ((r.occupied / r.total) * 100).toFixed(1)]), [], ['Vacant stall', 'Section', 'Status', 'Since', 'Days', 'Monthly rate'], ...(d?.vacant ?? []).map((v) => [v.code, v.sectionName, v.status, v.since ?? '', v.days, formatPesoPlain(v.monthlyRate)])]}
      document={
        <DocumentPage title="Occupancy and Vacancy Report" subtitle={scopeLabel(market)} signatures={[{ role: 'Prepared by', title: lguConfig.marketSupervisorTitle }]}>
          <DocTable>
            <thead>
              <tr>
                <th>Section</th>
                <th className="text-right">Occupied</th>
                <th className="text-right">Vacant</th>
                <th className="text-right">Reserved</th>
                <th className="text-right">Repair</th>
                <th className="text-right">Total</th>
                <th className="text-right">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sectionId}>
                  <td>{r.sectionName}</td>
                  <td className="num text-right">{r.occupied}</td>
                  <td className="num text-right">{r.vacant}</td>
                  <td className="num text-right">{r.reserved}</td>
                  <td className="num text-right">{r.repair}</td>
                  <td className="num text-right">{r.total}</td>
                  <td className="num text-right">{((r.occupied / r.total) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </DocTable>
          <h2 className="mt-6 mb-2 text-[13px] font-bold uppercase">Stalls not occupied</h2>
          <DocTable className="text-[11.5px]">
            <thead>
              <tr>
                <th>Stall</th>
                <th>Section</th>
                <th>Status</th>
                <th>Since</th>
                <th className="text-right">Days</th>
                <th className="text-right">Rate foregone / month</th>
              </tr>
            </thead>
            <tbody>
              {(d?.vacant ?? []).map((v) => (
                <tr key={v.stallId}>
                  <td className="num">{v.code}</td>
                  <td>{v.sectionName}</td>
                  <td>{t.stallStatus[v.status]}</td>
                  <td>{formatDate(v.since)}</td>
                  <td className="num text-right">{v.days}</td>
                  <td className="num text-right">{formatPeso(v.monthlyRate)}</td>
                </tr>
              ))}
            </tbody>
          </DocTable>
        </DocumentPage>
      }
    >
      {!d ? (
        <Loading q={q} />
      ) : (
        <>
          <ChartCard title="Occupancy rate, last 12 months" description="Share of stalls with an active lease at month end" table={<MiniTable head={['Month', 'Occupied', 'Rate']} rows={d.history.map((h) => [formatMonth(h.month), `${h.occupied} of ${h.total}`, `${((h.occupied / h.total) * 100).toFixed(1)}%`])} />}>
            <TrendChart data={d.history.map((h) => ({ month: h.month, rate: Math.round((h.occupied / h.total) * 1000) / 10 }))} xKey="month" xFormatter={(v) => formatMonthShort(v).slice(0, 3)} tooltipLabel={(v) => formatMonth(v)} valueFormat={(v) => `${v.toFixed(1)}%`} axisFormat={(v) => `${v}%`} series={[{ key: 'rate', label: 'Occupancy', color: SERIES[0] }]} ariaLabel="Line chart of occupancy rate over 12 months" />
          </ChartCard>
          <TableCard title="By section">
            <thead>
              <tr>
                <Th>Section</Th>
                <Th right>Occupied</Th>
                <Th right>Vacant</Th>
                <Th right>Reserved</Th>
                <Th right>Under repair</Th>
                <Th right>Total</Th>
                <Th right>Occupancy</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sectionId}>
                  <Td className="font-medium">
                    {r.sectionName} <span className="text-xs font-normal text-ink-muted">· {marketName(r.marketId, true)}</span>
                  </Td>
                  {[r.occupied, r.vacant, r.reserved, r.repair, r.total].map((n, i) => (
                    <Td key={i} right>
                      <span className="num">{n}</span>
                    </Td>
                  ))}
                  <Td right>
                    <span className="num font-semibold">{((r.occupied / r.total) * 100).toFixed(1)}%</span>
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-muted font-semibold">
              <tr>
                <Td>Totals</Td>
                {(['occupied', 'vacant', 'reserved', 'repair', 'total'] as const).map((k) => (
                  <Td key={k} right>
                    <span className="num">{sumBy(rows, (r) => r[k])}</span>
                  </Td>
                ))}
                <Td right>
                  <span className="num">{((sumBy(rows, (r) => r.occupied) / Math.max(1, sumBy(rows, (r) => r.total))) * 100).toFixed(1)}%</span>
                </Td>
              </tr>
            </tfoot>
          </TableCard>
          <TableCard title={`Stalls not occupied (${d.vacant.length})`}>
            <thead>
              <tr>
                <Th>Stall</Th>
                <Th>Section</Th>
                <Th>Status</Th>
                <Th>Since</Th>
                <Th right>Days</Th>
                <Th right>Schedule rate / month</Th>
              </tr>
            </thead>
            <tbody>
              {d.vacant.map((v) => (
                <tr key={v.stallId} className={v.days > 60 && v.status === 'vacant' ? 'bg-accent-soft/40' : undefined}>
                  <Td>
                    <StallCode code={v.code} />
                  </Td>
                  <Td>{v.sectionName}</Td>
                  <Td>
                    <StatusBadge kind="stall" value={v.status} />
                  </Td>
                  <Td>{formatDate(v.since)}</Td>
                  <Td right>
                    <span className={cn('num', v.days > 60 && 'font-semibold text-accent-ink')}>{v.days}</span>
                  </Td>
                  <Td right>
                    <Amount value={v.monthlyRate} />
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-muted font-semibold">
              <tr>
                <Td>Rental foregone a month</Td>
                <Td>{''}</Td>
                <Td>{''}</Td>
                <Td>{''}</Td>
                <Td>{''}</Td>
                <Td right>
                  <Amount value={sumBy(d.vacant, (v) => v.monthlyRate)} />
                </Td>
              </tr>
            </tfoot>
          </TableCard>
        </>
      )}
    </ReportShell>
  )
}

/* ------------------------------------------------------------ arrears */
export function ArrearsAgingReport() {
  const { market, today } = useAppContext()
  const q = useAgingBySection(market)
  const rows = q.data ?? []
  const totals = AGING_ORDER.map((k) => sumBy(rows, (r) => r.buckets[k]))
  const buckets = Object.fromEntries(AGING_ORDER.map((k, i) => [k, totals[i]!])) as Record<(typeof AGING_ORDER)[number], number>
  return (
    <ReportShell
      title="Arrears aging"
      description={`${scopeLabel(market)} · as of ${formatDate(today)}`}
      fileName={`arrears-aging-${today}`}
      csv={() => [['Section', 'Market', ...AGING_ORDER.map((k) => t.aging[k]), 'Total'], ...rows.map((r) => [r.sectionName, marketName(r.marketId, true), ...AGING_ORDER.map((k) => formatPesoPlain(r.buckets[k])), formatPesoPlain(r.total)]), ['TOTAL', '', ...totals.map(formatPesoPlain), formatPesoPlain(sumBy(rows, (r) => r.total))]]}
      document={
        <DocumentPage title="Aging of Accounts Receivable — Stall Rentals" subtitle={`${scopeLabel(market)} · as of ${formatDate(today)}`} signatures={[{ role: 'Prepared by', title: 'Revenue Collection Clerk' }, { role: 'Certified correct', title: lguConfig.treasurerTitle }]}>
          <DocTable>
            <thead>
              <tr>
                <th>Section</th>
                {AGING_ORDER.map((k) => (
                  <th key={k} className="text-right">
                    {t.aging[k]}
                  </th>
                ))}
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sectionId}>
                  <td>{r.sectionName}</td>
                  {AGING_ORDER.map((k) => (
                    <td key={k} className="num text-right">
                      {formatPeso(r.buckets[k])}
                    </td>
                  ))}
                  <td className="num text-right font-semibold">{formatPeso(r.total)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td>Total</td>
                {totals.map((v, i) => (
                  <td key={i} className="num text-right">
                    {formatPeso(v)}
                  </td>
                ))}
                <td className="num text-right">{formatPeso(sumBy(rows, (r) => r.total))}</td>
              </tr>
            </tbody>
          </DocTable>
        </DocumentPage>
      }
    >
      {!q.data ? (
        <Loading q={q} />
      ) : (
        <>
          <Card className="p-5">
            <p className="text-sm text-ink-muted">Total receivable</p>
            <Amount value={sumBy(rows, (r) => r.total)} size="lg" />
            <AgingBar buckets={buckets} className="mt-4" />
          </Card>
          <ChartCard title="By section and age" table={<MiniTable head={['Section', 'Total']} rows={rows.map((r) => [r.sectionName, <Amount key={r.sectionId} value={r.total} />])} />}>
            <BarsChart data={rows.map((r) => ({ name: r.sectionName, ...r.buckets }))} xKey="name" layout="vertical" stacked height={Math.max(240, rows.length * 38)} series={AGING_ORDER.map((k) => ({ key: k, label: t.aging[k], color: AGING_COLOR[k] }))} ariaLabel="Stacked bar chart of arrears by section and age" />
          </ChartCard>
        </>
      )}
    </ReportShell>
  )
}

/* ------------------------------------------------------------- yearly */
export function YearlyTrendReport() {
  const { market, today } = useAppContext()
  const [year, setYear] = React.useState(Number(today.slice(0, 4)))
  const q = useYearlyTrend(year, market)
  const d = q.data
  return (
    <ReportShell
      title="Yearly income trend"
      description={`${scopeLabel(market)} · ${year} compared with ${year - 1}`}
      fileName={`yearly-trend-${year}`}
      filters={
        <FilterField label="Year">
          <NativeSelect value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {[0, 1].map((i) => {
              const y = Number(today.slice(0, 4)) - i
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            })}
          </NativeSelect>
        </FilterField>
      }
      csv={() => [['Month', String(year), String(year - 1)], ...(d?.months ?? []).map((m) => [m.label, m.current === null ? '' : formatPesoPlain(m.current), formatPesoPlain(m.previous)])]}
      document={
        <DocumentPage title="Market Income Trend" subtitle={`${scopeLabel(market)} · ${year} vs ${year - 1}`} signatures={[{ role: 'Certified correct', title: lguConfig.treasurerTitle }]}>
          <DocTable>
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">{year}</th>
                <th className="text-right">{year - 1}</th>
                <th className="text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {d?.months.map((m) => (
                <tr key={m.month}>
                  <td>{m.label}</td>
                  <td className="num text-right">{m.current === null ? '—' : formatPeso(m.current)}</td>
                  <td className="num text-right">{formatPeso(m.previous)}</td>
                  <td className="num text-right">{m.current === null ? '—' : pct(m.current, m.previous)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td>Year to date</td>
                <td className="num text-right">{formatPeso(d?.currentTotal ?? 0)}</td>
                <td className="num text-right">{formatPeso(d?.previousSamePeriod ?? 0)}</td>
                <td className="num text-right">{pct(d?.currentTotal ?? 0, d?.previousSamePeriod ?? 0)}</td>
              </tr>
            </tbody>
          </DocTable>
        </DocumentPage>
      }
    >
      {!d ? (
        <Loading q={q} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard label={`${year} year to date`} value={<Amount value={d.currentTotal} size="kpi" />} delta={d.previousSamePeriod ? (d.currentTotal - d.previousSamePeriod) / d.previousSamePeriod : null} deltaLabel={`vs. same months of ${year - 1}`} />
            <KpiCard label={`${year - 1}, same months`} value={<Amount value={d.previousSamePeriod} size="kpi" />} deltaLabel={`Full year ${year - 1}: ${formatPeso(sumBy(d.months, (m) => m.previous))}`} />
          </div>
          <ChartCard title="Monthly income" description={`${year} solid, ${year - 1} dashed`} table={<MiniTable head={['Month', String(year), String(year - 1)]} rows={d.months.map((m) => [m.label, m.current === null ? '—' : <Amount key="c" value={m.current} />, <Amount key="p" value={m.previous} />])} />}>
            <TrendChart data={d.months.map((m) => ({ label: m.label, current: m.current, previous: m.previous }))} xKey="label" series={[{ key: 'current', label: String(year), color: SERIES[0] }, { key: 'previous', label: String(year - 1), color: 'var(--chart-muted)', dashed: true }]} ariaLabel="Line chart of monthly income compared with last year" area={false} />
          </ChartCard>
        </>
      )}
    </ReportShell>
  )
}

/* --------------------------------------------------------------- SB */
export function SbSummaryReport() {
  const { today } = useAppContext()
  const [month, setMonth] = React.useState(monthKey(today))
  const q = useSbSummary(month)
  const d = q.data
  const totalNow = sumBy(d?.collections ?? [], (c) => c.amount)
  const totalPrev = sumBy(d?.collections ?? [], (c) => c.previousYear)
  const occ = d ? { occupied: sumBy(d.occupancy, (o) => o.occupied), total: sumBy(d.occupancy, (o) => o.total) } : { occupied: 0, total: 1 }
  const body = d ? (
    <>
      <h2 className="mb-2 text-[13px] font-bold uppercase">1. Collections</h2>
      <DocTable>
        <thead>
          <tr>
            <th>Market</th>
            <th className="text-right">{formatMonth(month)}</th>
            <th className="text-right">Same month last year</th>
            <th className="text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {d.collections.map((c) => (
            <tr key={c.marketId}>
              <td>{marketName(c.marketId)}</td>
              <td className="num text-right">{formatPeso(c.amount)}</td>
              <td className="num text-right">{formatPeso(c.previousYear)}</td>
              <td className="num text-right">{pct(c.amount, c.previousYear)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td>Total</td>
            <td className="num text-right">{formatPeso(totalNow)}</td>
            <td className="num text-right">{formatPeso(totalPrev)}</td>
            <td className="num text-right">{pct(totalNow, totalPrev)}</td>
          </tr>
        </tbody>
      </DocTable>
      <h2 className="mt-5 mb-2 text-[13px] font-bold uppercase">2. Occupancy</h2>
      <DocTable>
        <thead>
          <tr>
            <th>Market</th>
            <th className="text-right">Occupied</th>
            <th className="text-right">Total stalls</th>
            <th className="text-right">Rate</th>
          </tr>
        </thead>
        <tbody>
          {d.occupancy.map((o) => (
            <tr key={o.marketId}>
              <td>{marketName(o.marketId)}</td>
              <td className="num text-right">{o.occupied}</td>
              <td className="num text-right">{o.total}</td>
              <td className="num text-right">{((o.occupied / o.total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </DocTable>
      <h2 className="mt-5 mb-2 text-[13px] font-bold uppercase">3. Arrears ({d.arrearsAccounts} accounts past due)</h2>
      <DocTable>
        <thead>
          <tr>
            {AGING_ORDER.map((k) => (
              <th key={k} className="text-right">
                {t.aging[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {AGING_ORDER.map((k) => (
              <td key={k} className="num text-right">
                {formatPeso(d.aging[k])}
              </td>
            ))}
          </tr>
        </tbody>
      </DocTable>
      <h2 className="mt-5 mb-2 text-[13px] font-bold uppercase">4. Current rates (for reference)</h2>
      <DocTable>
        <thead>
          <tr>
            <th>Fee</th>
            <th className="text-right">Rate</th>
            <th>Basis</th>
          </tr>
        </thead>
        <tbody>
          {d.rates.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num text-right">{formatPeso(r.amount)}</td>
              <td>{r.ordinanceRef}</td>
            </tr>
          ))}
        </tbody>
      </DocTable>
    </>
  ) : null
  return (
    <ReportShell
      title="Summary for the Sangguniang Bayan"
      description={`Collections, occupancy and arrears · ${formatMonth(month)}`}
      fileName={`sb-summary-${month}`}
      filters={
        <FilterField label="Month">
          <Input type="month" max={monthKey(today)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />
        </FilterField>
      }
      csv={() => [['Market', 'Collections', 'Same month last year'], ...(d?.collections ?? []).map((c) => [marketName(c.marketId), formatPesoPlain(c.amount), formatPesoPlain(c.previousYear)]), [], ['Aging', ...AGING_ORDER.map((k) => t.aging[k])], ['Amount', ...AGING_ORDER.map((k) => formatPesoPlain(d?.aging[k] ?? 0))]]}
      document={
        <DocumentPage title="Market Operations Summary" subtitle={`For the Sangguniang Bayan · ${formatMonth(month)}`} signatures={[{ role: 'Submitted by', title: lguConfig.treasurerTitle }]} office={`${lguConfig.officeName}`}>
          {body}
        </DocumentPage>
      }
    >
      {!d ? (
        <Loading q={q} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label={`Collections, ${formatMonthShort(month)}`} value={<Amount value={totalNow} size="kpi" />} delta={totalPrev ? (totalNow - totalPrev) / totalPrev : null} deltaLabel="vs. same month last year" />
            <KpiCard label="Occupancy" value={<span className="num text-[1.625rem] font-semibold">{((occ.occupied / occ.total) * 100).toFixed(1)}%</span>} deltaLabel={`${occ.occupied} of ${occ.total} stalls`} />
            <KpiCard label="Arrears past due" value={<Amount value={d.aging.d1_30 + d.aging.d31_60 + d.aging.d61_90 + d.aging.d90_plus} size="kpi" />} deltaLabel={`${d.arrearsAccounts} accounts`} />
          </div>
          <ChartCard title="Collections by type" table={<MiniTable head={['Type', 'Amount']} rows={d.byType.map((b) => [t.collectionType[b.type], <Amount key={b.type} value={b.amount} />])} />}>
            <BarsChart data={d.byType.map((b) => ({ name: t.collectionType[b.type], amount: b.amount }))} xKey="name" layout="vertical" height={220} series={[{ key: 'amount', label: 'Collected', color: SERIES[0] }]} ariaLabel="Bar chart of collections by type" />
          </ChartCard>
          <Card className="p-5">
            <div className="text-[13.5px] [&_table]:w-full">{body}</div>
          </Card>
        </>
      )}
    </ReportShell>
  )
}
