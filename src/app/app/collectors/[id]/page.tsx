'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { BanIcon, MapPinnedIcon, PlayCircleIcon, SmartphoneIcon, SmartphoneNfcIcon } from 'lucide-react'
import { BarsChart, ChartCard, MiniTable, SERIES } from '@/components/charts'
import { Amount } from '@/components/finance/amount'
import { SyncIndicator } from '@/components/market/sync-indicator'
import { DetailList, Timeline } from '@/components/shared/detail'
import { PageHeader } from '@/components/shared/page-header'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState, ErrorState, Notice, PageSkeleton } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/controls'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { marketName } from '@/config/lgu'
import { useAssignSections, useCollector, useDeactivateDevice, useReinstateCollector, useSections, useSuspendCollector } from '@/hooks/api'
import { t } from '@/i18n'
import type { CollectorDetail } from '@/lib/api'
import { useAppContext } from '@/lib/app-context'
import { formatDate, formatDateTime, formatDayShort, formatMonth, monthKey } from '@/lib/dates'
import { formatPeso, sumBy } from '@/lib/money'
import { formatCount } from '@/lib/utils'

export default function CollectorDetailPage() {
  return (
    <RoleGate permission="collectors.view" page="collector records">
      <CollectorView />
    </RoleGate>
  )
}

function CollectorView() {
  const { id } = useParams<{ id: string }>()
  const { today } = useAppContext()
  const [month, setMonth] = React.useState(monthKey(today))
  const q = useCollector(id, month)
  const can = useCan()
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [suspendOpen, setSuspendOpen] = React.useState(false)
  const [deviceOpen, setDeviceOpen] = React.useState(false)
  const suspend = useSuspendCollector()
  const reinstate = useReinstateCollector()
  const deactivate = useDeactivateDevice()
  if (q.isLoading && !q.data) return <PageSkeleton />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />
  const d = q.data
  const c = d.collector
  const device = c.device

  return (
    <>
      <PageHeader
        documentTitle={c.fullName}
        eyebrow={`Collector ${c.code} · ${marketName(c.marketId)}`}
        title={c.fullName}
        meta={
          <>
            <StatusBadge kind="active" value={c.status} />
            <span className="text-sm text-ink-muted">Since {formatDate(c.employedSince)}</span>
          </>
        }
        actions={
          can('collectors.manage') ? (
            <>
              <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                <MapPinnedIcon /> Assign sections
              </Button>
              {c.status === 'active' ? (
                <Button variant="secondary" onClick={() => setSuspendOpen(true)}>
                  <BanIcon /> Suspend
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => reinstate.mutate(c.id, { onSuccess: () => toast.success(`${c.fullName} reinstated.`) })}>
                  <PlayCircleIcon /> Reinstate
                </Button>
              )}
            </>
          ) : null
        }
      />
      {c.status === 'suspended' ? (
        <Notice tone="danger" className="mb-4">
          Suspended: {c.suspendedReason}
        </Notice>
      ) : null}
      {c.syncStale ? (
        <Notice tone="warning" className="mb-4">
          The phone has not synced for over 2 hours. {c.unsyncedCount} entries recorded today are still on the device and are not yet on the server.
        </Notice>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="grid gap-2">
              {d.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a.sectionName}</span>
                  <span className="text-xs text-ink-muted">since {formatDate(a.effectiveFrom)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-ink-muted">Contact: <span className="num">{c.contactNumber}</span></p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Device</CardTitle>
            {can('collectors.manage') && device?.status === 'active' ? (
              <Button variant="ghost" size="sm" className="text-money-short" onClick={() => setDeviceOpen(true)}>
                <SmartphoneNfcIcon /> Deactivate
              </Button>
            ) : null}
          </CardHeader>
          <CardBody>
            {device ? (
              <DetailList
                items={[
                  { label: 'Phone', value: `${device.label} · ${device.model}` },
                  { label: 'Serial no.', value: <span className="num">{device.serialNo}</span> },
                  { label: 'App version', value: device.appVersion === '1.4.2' ? `v${device.appVersion}` : <span className="text-accent-ink">v{device.appVersion} (update available)</span> },
                  { label: 'Battery', value: `${device.batteryPct}%` },
                  { label: 'Last sync', value: <SyncIndicator lastSyncAt={device.lastSyncAt} unsynced={c.unsyncedCount} /> },
                ]}
              />
            ) : (
              <EmptyState compact icon={<SmartphoneIcon />} title="No active device" description="Register and assign a phone before the next collection day." />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Accountable forms held</CardTitle>
          </CardHeader>
          <CardBody>
            {d.series.length ? (
              <ul className="grid gap-2 text-sm">
                {d.series.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="num text-[13px]">
                      {s.formType === 'af51' ? 'OR' : 'CT'} {String(s.start).padStart(7, '0')}–{String(s.end).padStart(7, '0')}
                    </span>
                    <span className="text-xs text-ink-muted">{s.status === 'missing' ? <StatusBadge kind="series" value="missing" /> : `${formatCount(s.remaining)} left`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">None.</p>
            )}
            <Link href={`/app/accountable-forms/summary?collector=${c.id}&month=${month}`} className="mt-3 inline-block text-[13px] text-primary hover:underline">
              Accountability summary →
            </Link>
          </CardBody>
        </Card>
      </div>

      <ChartCard
        className="mb-6"
        title={`Daily totals · ${formatMonth(month)}`}
        description={`${formatPeso(sumBy(d.dailyTotals, (x) => x.amount))} recorded · ${formatPeso(sumBy(d.dailyTotals, (x) => x.remitted))} remitted`}
        actions={<Input type="month" aria-label="Month" value={month} max={monthKey(today)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-36" />}
        table={<MiniTable head={['Day', 'Recorded', 'Remitted', 'Variance']} rows={[...d.dailyTotals].reverse().map((x) => [formatDate(x.date), <Amount key="a" value={x.amount} />, x.hasRemittance ? <Amount key="r" value={x.remitted} /> : '—', x.hasRemittance ? <Amount key="v" value={x.variance} signed positiveTone dashZero /> : '—'])} />}
      >
        <BarsChart data={d.dailyTotals.map((x) => ({ date: x.date, amount: x.amount }))} xKey="date" xFormatter={(v) => formatDayShort(v)} series={[{ key: 'amount', label: 'Recorded', color: SERIES[0] }]} height={220} ariaLabel="Bar chart of daily totals for the month" />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Variance history</CardTitle>
              <CardDescription>Days in the last 90 where the remittance did not match recorded collections.</CardDescription>
            </div>
          </CardHeader>
          {d.varianceHistory.length ? (
            <ul className="divide-y divide-border">
              {d.varianceHistory.map((v) => (
                <li key={v.date} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <Link href={`/app/reconciliation?date=${v.date}`} className="text-sm font-medium text-primary hover:underline">
                      {formatDate(v.date)}
                    </Link>
                    <p className="text-[13px] text-ink-muted">{v.flagReason ?? 'Not yet explained'}</p>
                  </div>
                  <span className="grid justify-items-end gap-1">
                    <Amount value={v.variance} signed positiveTone />
                    <StatusBadge kind="recon" value={v.status === 'closed' ? (v.statusBeforeClose ?? 'closed') : v.status} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No variances" description="Every remittance matched in the last 90 days." />
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Device history</CardTitle>
          </CardHeader>
          <CardBody>
            <Timeline items={d.deviceEvents.map((e) => ({ id: e.id, title: e.note, meta: `${formatDateTime(e.at)} · ${d.devices.find((x) => x.id === e.deviceId)?.label ?? e.deviceId}` }))} />
          </CardBody>
        </Card>
      </div>

      {assignOpen ? <AssignDialog detail={d} onClose={() => setAssignOpen(false)} /> : null}
      <ReasonDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={`Suspend ${c.fullName}?`}
        description="A suspended collector cannot record collections. Their assigned sections stay unassigned until you reassign them."
        confirmLabel="Suspend collector"
        tone="danger"
        pending={suspend.isPending}
        onConfirm={(reason) => suspend.mutate({ id: c.id, reason }, { onSuccess: () => { toast.success(`${c.fullName} suspended.`); setSuspendOpen(false) } })}
      />
      {device ? (
        <ReasonDialog
          open={deviceOpen}
          onOpenChange={setDeviceOpen}
          title={`Deactivate ${device.label}?`}
          description={
            <span className="grid gap-2">
              <span>Use this when a phone is lost, stolen or replaced. The phone can no longer sign in or sync.</span>
              {c.unsyncedCount > 0 ? (
                <strong className="text-money-short">
                  Risk: {c.unsyncedCount} entries recorded today have not synced. If you deactivate now they will not reach the server, and the collector must re-encode them from the ticket stubs.
                </strong>
              ) : (
                <span>All entries from this phone have synced.</span>
              )}
            </span>
          }
          confirmLabel="Deactivate device"
          tone="danger"
          pending={deactivate.isPending}
          onConfirm={(reason) => deactivate.mutate({ deviceId: device.id, reason }, { onSuccess: () => { toast.success(`${device.label} deactivated.`); setDeviceOpen(false) } })}
        />
      ) : null}
    </>
  )
}

function AssignDialog({ detail, onClose }: { detail: CollectorDetail; onClose: () => void }) {
  const sections = useSections('all')
  const assign = useAssignSections()
  const [chosen, setChosen] = React.useState<Set<string>>(new Set(detail.collector.sectionIds))
  const marketOf = [...chosen].map((id) => sections.data?.find((s) => s.id === id)?.marketId)[0]
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Assign sections to {detail.collector.fullName}</DialogTitle>
          <DialogDescription>A collector works in one market. Assigning a section moves it away from its current collector.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {['pm', 'sm'].map((m) => (
            <fieldset key={m} disabled={Boolean(marketOf && marketOf !== m)} className="disabled:opacity-50">
              <legend className="mb-2 text-sm font-semibold">{marketName(m, true)}</legend>
              <div className="grid gap-2">
                {sections.data
                  ?.filter((s) => s.marketId === m)
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`as-${s.id}`}
                        checked={chosen.has(s.id)}
                        onCheckedChange={(v) =>
                          setChosen((prev) => {
                            const n = new Set(prev)
                            if (v) n.add(s.id)
                            else n.delete(s.id)
                            return n
                          })
                        }
                      />
                      <Label htmlFor={`as-${s.id}`} className="font-normal">
                        {s.name}
                      </Label>
                    </div>
                  ))}
              </div>
            </fieldset>
          ))}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            disabled={chosen.size === 0 || assign.isPending}
            onClick={() =>
              assign.mutate(
                { id: detail.collector.id, sectionIds: [...chosen] },
                {
                  onSuccess: () => {
                    toast.success('Assignments updated.')
                    onClose()
                  },
                },
              )
            }
          >
            {assign.isPending ? t.common.saving : 'Save assignments'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
