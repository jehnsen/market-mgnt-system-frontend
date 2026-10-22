'use client'

import dynamic from 'next/dynamic'
import * as React from 'react'
import { BarChart3Icon, TableIcon } from 'lucide-react'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

const chartFallback = () => <Skeleton className="h-[260px] w-full" />

/** Charts are client-only and lazy-loaded so Recharts never blocks first paint. */
export const BarsChart = dynamic(() => import('./charts').then((m) => m.BarsChart), { ssr: false, loading: chartFallback })
export const TrendChart = dynamic(() => import('./charts').then((m) => m.TrendChart), { ssr: false, loading: chartFallback })

export type { SeriesDef } from './charts'

/** Categorical series colors, in fixed order (validated). Never cycle past five. */
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const

interface ChartCardProps {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  /** Same data as a table: shown via the Chart/Table toggle for accessibility and print. */
  table?: React.ReactNode
  className?: string
  bodyClassName?: string
}

export function ChartCard({ title, description, actions, children, table, className, bodyClassName }: ChartCardProps) {
  const [view, setView] = React.useState<'chart' | 'table'>('chart')
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <div className="no-print flex items-center gap-2">
          {actions}
          {table ? (
            <Segmented
              size="sm"
              label={`${title}: view as`}
              value={view}
              onChange={setView}
              options={[
                { value: 'chart', label: <span className="sr-only sm:not-sr-only">Chart</span>, icon: <BarChart3Icon aria-hidden /> },
                { value: 'table', label: <span className="sr-only sm:not-sr-only">Table</span>, icon: <TableIcon aria-hidden /> },
              ]}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardBody className={bodyClassName}>{view === 'chart' || !table ? children : table}</CardBody>
    </Card>
  )
}

/** Small plain table used as the accessible alternative to a chart. */
export function MiniTable({ head, rows, className }: { head: React.ReactNode[]; rows: React.ReactNode[][]; className?: string }) {
  return (
    <div className={cn('max-h-80 overflow-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className={cn('sticky top-0 border-b border-border bg-surface py-2 text-left text-xs font-semibold text-ink-muted', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((c, j) => (
                <td key={j} className={cn('py-1.5', j > 0 && 'text-right')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
