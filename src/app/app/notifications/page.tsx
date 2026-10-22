'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, BellOffIcon, CalendarClockIcon, CheckCheckIcon, CloudOffIcon, CopyIcon, FileCheck2Icon, LockOpenIcon, MessageSquareWarningIcon, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/api'
import { t } from '@/i18n'
import { formatAgo, formatDateTime, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { AppNotification, NotificationKind } from '@/types'

const ICON: Record<NotificationKind, LucideIcon> = {
  variance: AlertTriangleIcon,
  device_unsynced: CloudOffIcon,
  day_not_closed: LockOpenIcon,
  lease_expiring: CalendarClockIcon,
  billing_complete: FileCheck2Icon,
  sms_failed: MessageSquareWarningIcon,
  serial_gap: CopyIcon,
}

export default function NotificationsPage() {
  const q = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date())
  }, [])
  const today = todayISO()
  const groups = React.useMemo(() => {
    const list = q.data ?? []
    return [
      { label: 'Today', items: list.filter((n) => todayISO(new Date(n.at)) === today) },
      { label: 'Earlier', items: list.filter((n) => todayISO(new Date(n.at)) !== today) },
    ].filter((g) => g.items.length)
  }, [q.data, today])
  const unread = q.data?.filter((n) => !n.read).length ?? 0

  return (
    <>
      <PageHeader
        title={t.pages.notifications.title}
        meta={<span className="text-sm text-ink-muted">{unread ? `${unread} unread` : 'All caught up'}</span>}
        actions={
          <Button variant="secondary" onClick={() => markAll.mutate()} disabled={unread === 0}>
            <CheckCheckIcon /> Mark all as read
          </Button>
        }
      />
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState icon={<BellOffIcon />} title="No notifications" description="Variances, unsynced devices, unclosed days and other alerts will show here." />
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <section key={g.label} aria-labelledby={`ng-${g.label}`}>
              <h2 id={`ng-${g.label}`} className="mb-2 text-sm font-semibold text-ink-muted">
                {g.label}
              </h2>
              <Card>
                <ul className="divide-y divide-border">
                  {g.items.map((n) => (
                    <Item key={n.id} n={n} now={now} onRead={() => markRead.mutate(n.id)} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function Item({ n, now, onRead }: { n: AppNotification; now: Date | null; onRead: () => void }) {
  const Icon = ICON[n.kind]
  return (
    <li className={cn('flex gap-3 px-4 py-3 sm:px-5', !n.read && 'bg-primary-soft/40')}>
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', n.read ? 'bg-surface-muted text-ink-muted' : 'bg-accent-soft text-accent-ink')}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', !n.read && 'font-semibold')}>
          {!n.read ? <span className="sr-only">Unread: </span> : null}
          <Link href={n.href} onClick={onRead} className="hover:underline">
            {n.title}
          </Link>
        </p>
        <p className="text-[13px] text-ink-muted">{n.body}</p>
        <p className="mt-0.5 text-xs text-ink-subtle" title={formatDateTime(n.at)}>
          {now ? formatAgo(n.at, now) : formatDateTime(n.at)}
        </p>
      </div>
      {!n.read ? (
        <Button variant="ghost" size="sm" onClick={onRead} aria-label={`Mark "${n.title}" as read`}>
          Mark read
        </Button>
      ) : null}
    </li>
  )
}
