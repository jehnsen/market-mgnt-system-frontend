'use client'

import * as React from 'react'
import { CloudIcon, CloudOffIcon } from 'lucide-react'
import { formatAgo, formatDateTime, minutesSince } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { ISODateTime } from '@/types'

/** Last sync time with a stale warning after 2 hours. */
export function SyncIndicator({
  lastSyncAt,
  unsynced = 0,
  className,
  compact,
}: {
  lastSyncAt: ISODateTime | null
  unsynced?: number
  className?: string
  compact?: boolean
}) {
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  if (!now) return <span className={cn('text-[13px] text-ink-muted', className)}>—</span>
  const stale = minutesSince(lastSyncAt, now) > 120
  const Icon = stale ? CloudOffIcon : CloudIcon
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap', stale ? 'font-medium text-accent-ink' : 'text-ink-muted', className)}
      title={lastSyncAt ? `Last sync ${formatDateTime(lastSyncAt)}` : 'Never synced'}
    >
      <Icon className={cn('size-3.5', stale ? 'text-accent' : 'text-ink-subtle')} aria-hidden />
      <span>
        {stale ? 'Stale · ' : ''}
        {formatAgo(lastSyncAt, now)}
      </span>
      {!compact && unsynced > 0 ? (
        <span className="rounded bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent-ink">{unsynced} unsynced</span>
      ) : null}
    </span>
  )
}
