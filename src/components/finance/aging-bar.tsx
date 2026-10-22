import * as React from 'react'
import { t } from '@/i18n'
import { formatPeso } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AgingBucket, Centavos } from '@/types'

export const AGING_ORDER: AgingBucket[] = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus']

/** Neutral for "current", then one warm hue stepping darker with age (validated ordinal ramp). */
export const AGING_COLOR: Record<AgingBucket, string> = {
  current: 'var(--aging-current)',
  d1_30: 'var(--aging-1)',
  d31_60: 'var(--aging-2)',
  d61_90: 'var(--aging-3)',
  d90_plus: 'var(--aging-4)',
}

/** Horizontal stacked bar of arrears by age, with a legend that carries the figures. */
export function AgingBar({ buckets, className, showLegend = true }: { buckets: Record<AgingBucket, Centavos>; className?: string; showLegend?: boolean }) {
  const total = AGING_ORDER.reduce((s, k) => s + Math.max(0, buckets[k]), 0)
  return (
    <div className={cn('@container', className)}>
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={`Arrears by age: ${AGING_ORDER.map((k) => `${t.aging[k]} ${formatPeso(buckets[k])}`).join(', ')}`}
      >
        {total > 0
          ? AGING_ORDER.map((k) =>
              buckets[k] > 0 ? (
                <div key={k} style={{ width: `${(buckets[k] / total) * 100}%`, backgroundColor: AGING_COLOR[k] }} className="h-full min-w-[3px]" />
              ) : null,
            )
          : null}
      </div>
      {showLegend ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 @lg:grid-cols-5">
          {AGING_ORDER.map((k) => (
            <div key={k} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span aria-hidden className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: AGING_COLOR[k] }} />
                {t.aging[k]}
              </dt>
              <dd className={cn('num mt-0.5 text-sm font-medium', k === 'd90_plus' && buckets[k] > 0 && 'text-money-short')}>{formatPeso(buckets[k])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
