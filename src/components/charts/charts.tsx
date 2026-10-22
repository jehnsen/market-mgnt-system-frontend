'use client'

import * as React from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { formatPeso, formatPesoCompact } from '@/lib/money'

/* Shared styling: recessive grid and axes, text in ink tokens, never series colors. */
const axisTick = { fill: 'var(--ink-muted)', fontSize: 12 }
const grid = <CartesianGrid stroke="var(--chart-grid)" vertical={false} />

export interface SeriesDef {
  key: string
  label: string
  color: string
  /** Comparison series render as a thin muted dashed line. */
  dashed?: boolean
}

type Datum = Record<string, string | number | null>

function ChartTooltip({ active, payload, label, formatLabel, valueFormat }: TooltipContentProps<number, string> & { formatLabel?: (l: string) => string; valueFormat: (v: number) => string }) {
  if (!active || !payload?.length) return null
  const total = payload.length > 2 ? payload.reduce((s, p) => s + (typeof p.value === 'number' ? p.value : 0), 0) : null
  return (
    <div className="min-w-44 rounded-md border border-border bg-surface-raised px-3 py-2 text-[13px] text-ink shadow-pop">
      <p className="mb-1 font-medium">{formatLabel ? formatLabel(String(label)) : label}</p>
      <ul className="grid gap-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span aria-hidden className="size-2 rounded-sm" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="num">{typeof p.value === 'number' ? valueFormat(p.value) : '—'}</span>
          </li>
        ))}
      </ul>
      {total !== null ? (
        <p className="mt-1 flex justify-between border-t border-border pt-1 font-medium">
          <span>Total</span>
          <span className="num">{valueFormat(total)}</span>
        </p>
      ) : null}
    </div>
  )
}

function Legend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className={s.dashed ? 'h-0.5 w-3 border-t-2 border-dashed' : 'size-2.5 rounded-sm'} style={s.dashed ? { borderColor: s.color } : { backgroundColor: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

interface BaseProps {
  data: Datum[]
  xKey: string
  height?: number
  xFormatter?: (v: string) => string
  tooltipLabel?: (v: string) => string
  valueFormat?: (v: number) => string
  axisFormat?: (v: number) => string
  ariaLabel: string
}

/** Vertical bars: one series, or stacked series with a legend. */
export function BarsChart({ data, xKey, series, stacked, height = 260, xFormatter, tooltipLabel, valueFormat = (v) => formatPeso(v), axisFormat = formatPesoCompact, ariaLabel, layout = 'horizontal' }: BaseProps & { series: SeriesDef[]; stacked?: boolean; layout?: 'horizontal' | 'vertical' }) {
  const vertical = layout === 'vertical'
  return (
    <figure aria-label={ariaLabel} className="m-0">
      <Legend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={layout} margin={{ top: 4, right: 8, bottom: 0, left: vertical ? 8 : 0 }} barCategoryGap={vertical ? '22%' : '28%'}>
            {vertical ? <CartesianGrid stroke="var(--chart-grid)" horizontal={false} /> : grid}
            {vertical ? (
              <>
                <XAxis type="number" tick={axisTick} tickFormatter={axisFormat} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey={xKey} tick={axisTick} width={128} axisLine={false} tickLine={false} tickFormatter={xFormatter} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} tick={axisTick} tickFormatter={xFormatter} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                <YAxis tick={axisTick} tickFormatter={axisFormat} width={56} axisLine={false} tickLine={false} />
              </>
            )}
            <Tooltip cursor={{ fill: 'var(--surface-muted)', opacity: 0.6 }} content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} formatLabel={tooltipLabel ?? xFormatter} valueFormat={valueFormat} />} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? 'a' : undefined}
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={stacked ? 1 : 0}
                radius={!stacked || i === series.length - 1 ? (vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0}
                maxBarSize={vertical ? 22 : 40}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

/** Change over time: primary series as a 2px line with a soft area; comparison series dashed and muted. */
export function TrendChart({ data, xKey, series, height = 260, xFormatter, tooltipLabel, valueFormat = (v) => formatPeso(v), axisFormat = formatPesoCompact, ariaLabel, area = true }: BaseProps & { series: SeriesDef[]; area?: boolean }) {
  const primary = series[0]
  return (
    <figure aria-label={ariaLabel} className="m-0">
      <Legend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {primary ? (
                <linearGradient id={`fill-${primary.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primary.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={primary.color} stopOpacity={0} />
                </linearGradient>
              ) : null}
            </defs>
            {grid}
            <XAxis dataKey={xKey} tick={axisTick} tickFormatter={xFormatter} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={axisTick} tickFormatter={axisFormat} width={56} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} formatLabel={tooltipLabel ?? xFormatter} valueFormat={valueFormat} />} />
            {primary && area ? <Area type="monotone" dataKey={primary.key} stroke="none" fill={`url(#fill-${primary.key})`} isAnimationActive={false} legendType="none" tooltipType="none" /> : null}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? '4 4' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
