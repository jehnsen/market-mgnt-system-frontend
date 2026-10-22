import * as React from 'react'
import { formatPeso } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Centavos } from '@/types'

interface AmountProps {
  value: Centavos
  className?: string
  /** Show + for positive amounts (variances, adjustments). */
  signed?: boolean
  /** Color positive amounts green (money in / overage). */
  positiveTone?: boolean
  /** Render zero as a dash. */
  dashZero?: boolean
  size?: 'sm' | 'md' | 'lg' | 'kpi'
  strike?: boolean
}

/** Peso amount: tabular mono figures, red with a minus sign when negative. */
export function Amount({ value, className, signed, positiveTone, dashZero, size = 'md', strike }: AmountProps) {
  if (dashZero && value === 0) {
    return (
      <span className={cn('num text-ink-subtle', className)} aria-label="zero">
        —
      </span>
    )
  }
  return (
    <span
      className={cn(
        'num whitespace-nowrap',
        size === 'sm' && 'text-[13px]',
        size === 'lg' && 'text-lg font-semibold',
        size === 'kpi' && 'text-[1.625rem] leading-9 font-semibold tracking-tight 2xl:text-[1.875rem]',
        value < 0 && 'text-money-short',
        positiveTone && value > 0 && 'text-money-in',
        strike && 'line-through decoration-1 opacity-70',
        className,
      )}
    >
      {formatPeso(value, { sign: signed ? 'always' : 'auto' })}
    </span>
  )
}

export function SerialNumber({ serial, formType, className }: { serial: string; formType?: string; className?: string }) {
  const prefix = formType === 'af51' ? 'OR' : formType === 'ct' ? 'CT' : formType?.toUpperCase()
  return (
    <span className={cn('num inline-flex items-baseline gap-1 text-[13px] whitespace-nowrap', className)}>
      {prefix ? <span className="text-[11px] text-ink-muted">{prefix}</span> : null}
      {serial}
    </span>
  )
}

export function StallCode({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn('num inline-flex rounded border border-border bg-surface-muted px-1.5 py-px text-[12.5px] font-medium whitespace-nowrap text-ink', className)}>
      {code}
    </span>
  )
}
