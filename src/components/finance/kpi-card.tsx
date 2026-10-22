import * as React from 'react'
import Link from 'next/link'
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: React.ReactNode
  /** Relative change vs. the comparison period, as a fraction (0.12 = +12%). */
  delta?: number | null
  deltaLabel?: React.ReactNode
  /** Is an increase good (collections) or bad (arrears)? */
  goodWhen?: 'up' | 'down'
  spark?: number[]
  footnote?: React.ReactNode
  href?: string
  tone?: 'default' | 'danger' | 'warning'
  progress?: { value: number; label: string }
  className?: string
}

/** Headline figure with comparison and an optional sparkline. */
export function KpiCard({ label, value, delta, deltaLabel, goodWhen = 'up', spark, footnote, href, tone = 'default', progress, className }: KpiCardProps) {
  const dir = delta === undefined || delta === null ? null : delta > 0.0005 ? 'up' : delta < -0.0005 ? 'down' : 'flat'
  const good = dir === null || dir === 'flat' ? null : dir === goodWhen
  const DeltaIcon = dir === 'up' ? ArrowUpRightIcon : dir === 'down' ? ArrowDownRightIcon : MinusIcon
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        {tone !== 'default' ? <span aria-hidden className={cn('mt-1 size-2 rounded-full', tone === 'danger' ? 'bg-money-short' : 'bg-accent')} /> : null}
      </div>
      <div className="mt-1.5">{value}</div>
      {progress ? (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={Math.round(progress.value)} aria-valuemin={0} aria-valuemax={100} aria-label={progress.label}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress.value)}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-muted">{progress.label}</p>
        </div>
      ) : null}
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0 text-xs text-ink-muted">
          {dir !== null && delta !== null && delta !== undefined ? (
            <span className={cn('mr-1 inline-flex items-center gap-0.5 font-semibold', good === true && 'text-money-in', good === false && 'text-money-short')}>
              <DeltaIcon className="size-3.5" aria-hidden />
              {delta > 0 ? '+' : delta < 0 ? '−' : ''}
              {Math.abs(delta * 100).toFixed(1)}%
            </span>
          ) : null}
          {deltaLabel}
          {footnote ? <div className="mt-0.5">{footnote}</div> : null}
        </div>
        {spark && spark.length > 1 ? <Sparkline values={spark} /> : null}
      </div>
    </>
  )
  const cls = cn('block rounded-lg border border-border bg-surface p-4 transition-colors', href && 'hover:border-border-strong', className)
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function Sparkline({ values, width = 84, height = 28, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => [i * step, height - 3 - ((v - min) / range) * (height - 6)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]!
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('shrink-0 overflow-visible', className)} aria-hidden>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill="var(--chart-1)" opacity={0.1} />
      <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--chart-1)" />
    </svg>
  )
}
