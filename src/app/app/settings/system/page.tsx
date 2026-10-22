'use client'

import { DatabaseBackupIcon, HardDriveIcon, SmartphoneIcon } from 'lucide-react'
import { DetailList } from '@/components/shared/detail'
import { SectionTitle } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { ErrorState, Notice, TableSkeleton } from '@/components/shared/states'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { useSystemStatus } from '@/hooks/api'
import { formatAgo, formatDateTime } from '@/lib/dates'
import { formatCount, percent } from '@/lib/utils'
import type { SystemStatus } from '@/types'

export default function SystemPage() {
  return (
    <RoleGate permission="settings.system" page="system status">
      <SectionTitle>System status</SectionTitle>
      <Status />
    </RoleGate>
  )
}

function Status() {
  const status = useSystemStatus()
  if (status.isLoading) return <TableSkeleton rows={4} />
  if (status.isError || !status.data) return <ErrorState onRetry={() => status.refetch()} />
  return <StatusCards s={status.data} />
}

function StatusCards({ s }: { s: SystemStatus }) {
  const storagePct = s.storageQuotaMb ? (s.storageUsedMb / s.storageQuotaMb) * 100 : 0
  const devicesOffline = s.devicesTotal - s.devicesOnline
  return (
    <div className="grid gap-4">
      <Notice>This page is for information only. Figures are sample data until MARCIS is connected to its server.</Notice>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="flex items-center gap-2">
              <DatabaseBackupIcon className="size-4 text-ink-muted" aria-hidden /> Last backup
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="font-heading text-xl font-semibold">{formatAgo(s.lastBackupAt)}</p>
            <p className="text-[13px] text-ink-muted">{formatDateTime(s.lastBackupAt)}</p>
            <p className={s.backupStatus === 'ok' ? 'mt-2 text-sm font-medium text-money-in' : 'mt-2 text-sm font-medium text-money-short'}>
              {s.backupStatus === 'ok' ? 'Completed without errors' : 'Completed with warnings'}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="flex items-center gap-2">
              <HardDriveIcon className="size-4 text-ink-muted" aria-hidden /> Storage
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="font-heading text-xl font-semibold">
              <span className="num">{formatCount(s.storageUsedMb)}</span> MB <span className="text-sm font-normal text-ink-muted">of {formatCount(s.storageQuotaMb)} MB</span>
            </p>
            <Progress className="mt-3" value={storagePct} aria-label="Storage used" indicatorClassName={storagePct >= 80 ? 'bg-money-short' : undefined} />
            <p className="mt-1 text-[13px] text-ink-muted">{percent(s.storageUsedMb, s.storageQuotaMb)} used</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="flex items-center gap-2">
              <SmartphoneIcon className="size-4 text-ink-muted" aria-hidden /> Devices online
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="font-heading text-xl font-semibold">
              <span className="num">{s.devicesOnline}</span> <span className="text-sm font-normal text-ink-muted">of {s.devicesTotal} active</span>
            </p>
            <p className={devicesOffline > 0 ? 'mt-2 text-sm font-medium text-money-short' : 'mt-2 text-sm font-medium text-money-in'}>
              {devicesOffline > 0 ? `${devicesOffline} not synced in the last 2 hours` : 'All devices synced recently'}
            </p>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle as="h3">Versions</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailList
            items={[
              { label: 'MARCIS web', value: <span className="font-mono">{s.appVersion}</span> },
              { label: 'API', value: <span className="font-mono">{s.apiVersion}</span> },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  )
}
