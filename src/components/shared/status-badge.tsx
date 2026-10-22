import * as React from 'react'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/** Colors come from the status tokens in globals.css, so both themes stay in sync. */
const TONE = {
  teal: 'var(--st-occupied)',
  slate: 'var(--st-vacant)',
  indigo: 'var(--st-reserved)',
  amber: 'var(--st-repair)',
  orange: 'var(--st-expiring)',
  red: 'var(--st-variance)',
  blue: 'var(--st-synced)',
  green: 'var(--st-reconciled)',
} as const

export type Tone = keyof typeof TONE

const MAP = {
  stall: {
    occupied: ['teal', t.stallStatus.occupied],
    vacant: ['slate', t.stallStatus.vacant],
    reserved: ['indigo', t.stallStatus.reserved],
    under_repair: ['amber', t.stallStatus.under_repair],
  },
  collection: {
    pending_sync: ['slate', t.collectionStatus.pending_sync],
    synced: ['blue', t.collectionStatus.synced],
    reconciled: ['green', t.collectionStatus.reconciled],
    variance: ['red', t.collectionStatus.variance],
    corrected: ['amber', t.collectionStatus.corrected],
  },
  recon: {
    open: ['slate', t.reconStatus.open],
    balanced: ['green', t.reconStatus.balanced],
    shortage: ['red', t.reconStatus.shortage],
    overage: ['amber', t.reconStatus.overage],
    closed: ['teal', t.reconStatus.closed],
  },
  lease: {
    active: ['teal', t.leaseStatus.active],
    expiring: ['orange', t.leaseStatus.expiring],
    expired: ['slate', t.leaseStatus.expired],
    terminated: ['red', t.leaseStatus.terminated],
    none: ['slate', t.leaseStatus.none],
  },
  series: {
    in_stock: ['slate', t.seriesStatus.in_stock],
    issued: ['blue', t.seriesStatus.issued],
    exhausted: ['green', t.seriesStatus.exhausted],
    returned: ['indigo', t.seriesStatus.returned],
    missing: ['red', t.seriesStatus.missing],
  },
  sms: {
    queued: ['slate', t.smsStatus.queued],
    sent: ['green', t.smsStatus.sent],
    failed: ['red', t.smsStatus.failed],
  },
  notice: {
    first: ['amber', t.noticeLevel.first],
    second: ['orange', t.noticeLevel.second],
    final: ['red', t.noticeLevel.final],
  },
  response: {
    none: ['slate', t.noticeResponse.none],
    paid: ['green', t.noticeResponse.paid],
    promised: ['blue', t.noticeResponse.promised],
    disputed: ['amber', t.noticeResponse.disputed],
  },
  active: {
    active: ['green', 'Active'],
    suspended: ['red', 'Suspended'],
    deactivated: ['slate', 'Deactivated'],
    invited: ['indigo', 'Invited'],
  },
  correction: {
    pending: ['amber', 'Correction pending'],
    approved: ['amber', 'Corrected'],
    rejected: ['slate', 'Correction rejected'],
  },
} as const satisfies Record<string, Record<string, readonly [Tone, string]>>

type Kind = keyof typeof MAP

type ValueOf<K extends Kind> = keyof (typeof MAP)[K]

interface BadgeProps {
  tone: Tone
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
  title?: string
}

export function Badge({ tone, children, className, icon, title }: BadgeProps) {
  const color = TONE[tone]
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 13%, var(--surface))`,
        color: `color-mix(in oklab, ${color} 70%, var(--ink))`,
      }}
    >
      {icon ?? <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </span>
  )
}

export function StatusBadge<K extends Kind>({ kind, value, className, suffix }: { kind: K; value: ValueOf<K>; className?: string; suffix?: React.ReactNode }) {
  const entry = (MAP[kind] as Record<string, readonly [Tone, string]>)[value as string]
  if (!entry) return null
  const [tone, label] = entry
  return (
    <Badge tone={tone} className={className}>
      {label}
      {suffix}
    </Badge>
  )
}

export function statusLabel<K extends Kind>(kind: K, value: ValueOf<K>): string {
  return (MAP[kind] as Record<string, readonly [Tone, string]>)[value as string]?.[1] ?? String(value)
}

export const toneColor = (tone: Tone) => TONE[tone]
