'use client'

import * as React from 'react'
import { AlertTriangleIcon, InboxIcon, LockIcon, RotateCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-muted text-ink-muted [&_svg]:size-5">
        {icon ?? <InboxIcon />}
      </div>
      <p className="font-heading text-base font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ onRetry, message, className }: { onRetry?: () => void; message?: string; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-money-short-soft text-money-short">
        <AlertTriangleIcon className="size-5" />
      </div>
      <p className="font-heading text-base font-semibold">{t.common.errorTitle}</p>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{message ?? t.common.errorBody}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCwIcon /> {t.common.retry}
        </Button>
      ) : null}
    </div>
  )
}

export function NoAccess({ what = 'this page' }: { what?: string }) {
  return (
    <EmptyState
      icon={<LockIcon />}
      title="You don't have access"
      description={`Your role cannot open ${what}. Use the role switcher in the account menu to preview another role.`}
    />
  )
}

/** Generic page skeleton: header, KPI row and a table. */
export function PageSkeleton({ kpis = 0, rows = 8 }: { kpis?: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={t.common.loading}>
      {kpis > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: kpis }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : null}
      <TableSkeleton rows={rows} />
    </div>
  )
}

export function TableSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface', className)} aria-busy="true">
      <div className="border-b border-border bg-surface-muted px-4 py-3">
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Notice({ tone = 'info', children, className, icon }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  const styles = {
    info: 'border-primary/25 bg-primary-soft text-ink',
    warning: 'border-accent/40 bg-accent-soft text-ink',
    danger: 'border-money-short/30 bg-money-short-soft text-ink',
    success: 'border-money-in/30 bg-money-in-soft text-ink',
  }[tone]
  return (
    <div className={cn('flex gap-2.5 rounded-md border px-3 py-2.5 text-[13.5px] leading-snug [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', styles, className)}>
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
