'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { PrinterIcon, RefreshCwIcon, XCircleIcon } from 'lucide-react'
import { LeaseContract } from '@/components/documents/lease-contract'
import { Amount, StallCode } from '@/components/finance/amount'
import { DetailList } from '@/components/shared/detail'
import { PageHeader } from '@/components/shared/page-header'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { ErrorState, Notice, PageSkeleton } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/form-field'
import { Input, MoneyInput, NativeSelect, Textarea } from '@/components/ui/input'
import { marketName } from '@/config/lgu'
import { useLease, useRateQuote, useRenewLease, useTerminateLease } from '@/hooks/api'
import { t } from '@/i18n'
import type { LeaseDetail } from '@/lib/api'
import { useAppContext } from '@/lib/app-context'
import { addDays, addMonths, formatDate } from '@/lib/dates'
import { formatPeso, parsePeso, toPesoInput } from '@/lib/money'

export default function LeaseDetailPage() {
  return (
    <RoleGate permission="leases.view" page="lease records">
      <LeaseDetailView />
    </RoleGate>
  )
}

function LeaseDetailView() {
  const { id } = useParams<{ id: string }>()
  const q = useLease(id)
  const can = useCan()
  const { today } = useAppContext()
  const [renewOpen, setRenewOpen] = React.useState(false)
  const [terminateOpen, setTerminateOpen] = React.useState(false)
  const [effective, setEffective] = React.useState(today)
  const terminate = useTerminateLease()
  if (q.isLoading) return <PageSkeleton />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />
  const d = q.data
  const l = d.lease
  const renewedBy = d.history.find((h) => h.renewedFromLeaseId === l.id)

  return (
    <>
      <PageHeader
        documentTitle={`Lease ${l.leaseNo}`}
        eyebrow={`${marketName(l.marketId)} · ${l.sectionName}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Lease <span className="num">{l.leaseNo}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge kind="lease" value={l.status === 'active' && l.daysToExpiry <= 30 ? 'expiring' : l.status} />
            <StallCode code={l.stallCode} />
            <Link href={`/app/lessees/${l.lesseeId}`} className="text-sm text-primary hover:underline">
              {l.lesseeName}
            </Link>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}>
              <PrinterIcon /> Print contract
            </Button>
            {can('leases.manage') && l.status === 'active' ? (
              <>
                <Button variant="secondary" onClick={() => setTerminateOpen(true)}>
                  <XCircleIcon /> Terminate
                </Button>
                <Button onClick={() => setRenewOpen(true)}>
                  <RefreshCwIcon /> Renew
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {renewedBy ? (
        <Notice tone="info" className="mb-4">
          Renewed as{' '}
          <Link href={`/app/leases/${renewedBy.id}`} className="num font-medium text-primary underline">
            {renewedBy.leaseNo}
          </Link>{' '}
          starting {formatDate(renewedBy.startDate)}.
        </Notice>
      ) : null}
      {l.status === 'terminated' ? (
        <Notice tone="danger" className="mb-4">
          Terminated effective {formatDate(l.terminatedOn)}. Reason: {l.terminationReason}
        </Notice>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Terms</CardTitle>
          </CardHeader>
          <CardBody>
            <DetailList
              cols={3}
              items={[
                { label: 'Start', value: formatDate(l.startDate) },
                { label: 'End', value: formatDate(l.endDate) },
                { label: 'Term', value: `${l.termMonths} months` },
                { label: 'Monthly rental', value: <Amount value={l.monthlyRate} /> },
                { label: 'Deposit', value: <Amount value={l.deposit} /> },
                { label: 'Days to expiry', value: l.status === 'active' ? <span className="num">{l.daysToExpiry}</span> : '—' },
                { label: 'Rate basis', value: d.quote.rate.ordinanceRef },
                { label: 'Fee schedule', value: `v${d.quote.schedule.version} · ${d.quote.schedule.ordinanceRef}` },
                { label: 'Created', value: `${formatDate(l.createdAt)} by ${l.createdByName}` },
              ]}
            />
            {l.specialConditions ? <p className="mt-4 text-sm"><span className="text-xs font-medium text-ink-muted">Special conditions</span><br />{l.specialConditions}</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-ink-muted">Balance on this lease</p>
            <Amount value={l.balance} size="lg" />
            <p className="mt-3 text-sm">
              <Link className="text-primary hover:underline" href={`/app/lessees/${l.lesseeId}`}>
                Statement of account →
              </Link>
            </p>
            <p className="mt-1 text-sm">
              <Link className="text-primary hover:underline" href={`/app/stalls/${l.stallId}`}>
                Stall record →
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>

      <LeaseContract
        data={{
          leaseNo: l.leaseNo,
          lesseeName: d.lessee.fullName,
          lesseeAddress: d.lessee.address,
          stallCode: l.stallCode,
          marketId: l.marketId,
          sectionName: l.sectionName,
          sizeSqm: d.stall.sizeSqm,
          startDate: l.startDate,
          termMonths: l.termMonths,
          monthlyRate: l.monthlyRate,
          deposit: l.deposit,
          specialConditions: l.specialConditions,
          schedule: d.quote.schedule,
          rateOrdinanceRef: d.quote.rate.ordinanceRef,
        }}
      />

      {l.status === 'active' ? <RenewDialog detail={d} open={renewOpen} onOpenChange={setRenewOpen} /> : null}
      <ReasonDialog
        open={terminateOpen}
        onOpenChange={setTerminateOpen}
        title={`Terminate lease ${l.leaseNo}?`}
        description="The stall becomes vacant on the effective date. Unpaid balances stay on the lessee's account. This is recorded in the audit log."
        confirmLabel="Terminate lease"
        tone="danger"
        pending={terminate.isPending}
        onConfirm={(reason) =>
          terminate.mutate(
            { id: l.id, effectiveDate: effective, reason },
            {
              onSuccess: () => {
                toast.success(`Lease ${l.leaseNo} terminated. Stall ${l.stallCode} is now vacant.`)
                setTerminateOpen(false)
              },
            },
          )
        }
      >
        <Field label="Effective date" htmlFor="term-eff">
          <Input id="term-eff" type="date" value={effective} min={l.startDate} onChange={(e) => setEffective(e.target.value)} />
        </Field>
      </ReasonDialog>
    </>
  )
}

function RenewDialog({ detail, open, onOpenChange }: { detail: LeaseDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const l = detail.lease
  const [start, setStart] = React.useState(addDays(l.endDate, 1))
  const [term, setTerm] = React.useState(12)
  const quote = useRateQuote(l.stallId, start)
  const [rate, setRate] = React.useState('')
  const [reason, setReason] = React.useState('')
  const renew = useRenewLease()
  const [error, setError] = React.useState<string | null>(null)
  const schedRate = quote.data?.rate.amount
  const effectiveRate = rate || (schedRate !== undefined ? toPesoInput(schedRate) : '')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Renew lease {l.leaseNo}</DialogTitle>
          <DialogDescription>
            Creates a new lease for stall {l.stallCode} with {l.lesseeName}. The current lease is marked as renewed. The rate defaults to the fee schedule in effect on the new start date.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const amount = parsePeso(effectiveRate)
            if (amount === null || amount <= 0) return setError('Enter a valid monthly rental.')
            setError(null)
            renew.mutate(
              { id: l.id, startDate: start, termMonths: term, monthlyRate: amount, reason },
              {
                onSuccess: (lease) => {
                  toast.success(`Renewed as ${lease.leaseNo}.`)
                  onOpenChange(false)
                },
              },
            )
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="New start date" htmlFor="rn-start">
              <Input id="rn-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Term" htmlFor="rn-term" hint={`Ends ${formatDate(addDays(addMonths(start, term), -1))}`}>
              <NativeSelect id="rn-term" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
                {[6, 12, 24, 36, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} months
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Monthly rental" htmlFor="rn-rate" error={error ?? undefined} hint={schedRate !== undefined ? `Schedule: ${formatPeso(schedRate)}` : undefined}>
              <MoneyInput id="rn-rate" value={effectiveRate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          </div>
          {quote.data ? <p className="text-[13px] text-ink-muted">Basis: {quote.data.rate.ordinanceRef} · {quote.data.schedule.ordinanceRef}</p> : null}
          <Field label="Notes" htmlFor="rn-notes" optional>
            <Textarea id="rn-notes" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: renewal application received Oct 15." />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={renew.isPending}>
              {renew.isPending ? t.common.saving : 'Renew lease'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
