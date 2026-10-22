'use client'

import * as React from 'react'
import Link from 'next/link'
import { BatteryMediumIcon, SmartphoneIcon } from 'lucide-react'
import { Amount } from '@/components/finance/amount'
import { SyncIndicator } from '@/components/market/sync-indicator'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { ErrorState, PageSkeleton } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card } from '@/components/ui/card'
import { marketName } from '@/config/lgu'
import { useCollectors } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatDate } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import { cn, formatCount, initials } from '@/lib/utils'

export default function CollectorsPage() {
  return (
    <RoleGate permission="collectors.view" page="collectors">
      <Collectors />
    </RoleGate>
  )
}

function Collectors() {
  const { market, date, isToday } = useAppContext()
  const q = useCollectors(market, date)
  return (
    <>
      <PageHeader
        title={t.pages.collectors.title}
        description={t.pages.collectors.description}
        meta={
          q.data ? (
            <span className="text-sm text-ink-muted">
              {q.data.length} collectors · {isToday ? 'today' : formatDate(date)}: {formatCount(sumBy(q.data, (c) => c.todayCount))} collections, <Amount value={sumBy(q.data, (c) => c.todayTotal)} size="sm" />
            </span>
          ) : null
        }
      />
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.isError || !q.data ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((c) => (
            <li key={c.id}>
              <Card className={cn('h-full transition-colors hover:border-border-strong', c.syncStale && 'border-accent')}>
                <Link href={`/app/collectors/${c.id}`} className="block p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">{initials(c.fullName)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-heading font-semibold">
                        {c.fullName} <span className="num text-xs font-normal text-ink-muted">{c.code}</span>
                      </p>
                      <p className="truncate text-[13px] text-ink-muted">
                        {marketName(c.marketId, true)} · {c.sectionNames.join(', ')}
                      </p>
                    </div>
                    <StatusBadge kind="active" value={c.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-ink-muted">{isToday ? "Today's total" : 'Day total'}</dt>
                      <dd>
                        <Amount value={c.todayTotal} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">Collections</dt>
                      <dd className="num">{formatCount(c.todayCount)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">Unsynced</dt>
                      <dd className={cn('num', c.unsyncedCount > 0 && 'font-semibold text-accent-ink')}>{c.unsyncedCount}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[13px]">
                    {c.device ? (
                      <span className="flex min-w-0 items-center gap-1.5 text-ink-muted">
                        <SmartphoneIcon className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">
                          {c.device.label} · {c.device.model} · v{c.device.appVersion}
                        </span>
                        <BatteryMediumIcon className="size-3.5 shrink-0" aria-hidden />
                        <span className="num">{c.device.batteryPct}%</span>
                      </span>
                    ) : (
                      <span className="text-money-short">No active device</span>
                    )}
                    <SyncIndicator lastSyncAt={c.lastSyncAt} compact />
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
