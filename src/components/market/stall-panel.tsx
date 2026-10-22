'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ExternalLinkIcon, FilePlus2Icon, MessageSquareTextIcon, WrenchIcon } from 'lucide-react'
import { Amount, StallCode } from '@/components/finance/amount'
import { useCan } from '@/components/shared/role-gate'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/form-field'
import { NativeSelect, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { marketName } from '@/config/lgu'
import { useSetStallStatus, useStall } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate } from '@/lib/dates'
import type { StallStatus, StallView } from '@/types'

export function StallPanel({ stallId, onClose }: { stallId: string | null; onClose: () => void }) {
  const q = useStall(stallId)
  const can = useCan()
  const [statusOpen, setStatusOpen] = React.useState(false)
  const d = q.data
  const s = d?.stall
  return (
    <Sheet open={Boolean(stallId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Stall {s ? <StallCode code={s.code} className="text-sm" /> : null}
          </SheetTitle>
          <SheetDescription>{s ? `${marketName(s.marketId, true)} · ${s.sectionName} · ${s.sizeSqm} m² ${s.type}` : t.common.loading}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {!d || !s ? (
            <div className="grid gap-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-wrap gap-2">
                <StatusBadge kind="stall" value={s.status} />
                {s.leaseExpiringSoon ? <StatusBadge kind="lease" value="expiring" /> : null}
                {s.inArrears ? <span className="inline-flex items-center rounded-md bg-money-short-soft px-2 py-0.5 text-xs font-medium text-money-short">{t.stallStatus.arrears}</span> : null}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-ink-muted">Current lessee</dt>
                  <dd className="font-medium">{d.lease ? <Link href={`/app/lessees/${d.lease.lesseeId}`} className="text-primary hover:underline">{d.lease.lesseeName}</Link> : s.status === 'vacant' && s.daysVacant !== null ? `Vacant for ${s.daysVacant} days` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Lease</dt>
                  <dd>{d.lease ? <Link href={`/app/leases/${d.lease.id}`} className="num hover:underline">{d.lease.leaseNo}</Link> : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Lease period</dt>
                  <dd>{d.lease ? `${formatDate(d.lease.startDate)} – ${formatDate(d.lease.endDate)}` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Monthly rate</dt>
                  <dd>{d.lease ? <Amount value={d.lease.monthlyRate} /> : d.monthlyRateQuote ? <span><Amount value={d.monthlyRateQuote} /> <span className="text-xs text-ink-muted">(schedule)</span></span> : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Balance</dt>
                  <dd>
                    <Amount value={s.balance} className={s.inArrears ? 'font-semibold text-money-short' : undefined} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Daily fee</dt>
                  <dd>{d.dailyFee ? <Amount value={d.dailyFee} /> : '—'}</dd>
                </div>
              </dl>

              <section aria-labelledby="recent-payments">
                <h3 id="recent-payments" className="mb-2 text-sm font-semibold">
                  Last 5 payments
                </h3>
                {d.recentPayments.length ? (
                  <ul className="divide-y divide-border rounded-md border border-border text-sm">
                    {d.recentPayments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span>
                          <span className="block">{formatDate(p.date)}</span>
                          <span className="num text-xs text-ink-muted">
                            OR {p.receiptSerial} · {p.kind === 'rental' ? 'Rental' : 'Surcharge'}
                          </span>
                        </span>
                        <Amount value={p.amount} className="text-money-in" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">No rental payments on record.</p>
                )}
              </section>
            </div>
          )}
        </SheetBody>
        {s ? (
          <SheetFooter>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/app/stalls/${s.id}`}>
                <ExternalLinkIcon /> View stall
              </Link>
            </Button>
            {can('leases.manage') && (s.status === 'vacant' || s.status === 'reserved') ? (
              <Button asChild size="sm">
                <Link href={`/app/leases/new?stall=${s.id}`}>
                  <FilePlus2Icon /> New lease
                </Link>
              </Button>
            ) : null}
            {can('messages.send') && s.lesseeId ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/messages?lessee=${s.lesseeId}`}>
                  <MessageSquareTextIcon /> Send reminder
                </Link>
              </Button>
            ) : null}
            {can('stalls.manage') && s.status !== 'occupied' ? (
              <Button variant="secondary" size="sm" onClick={() => setStatusOpen(true)}>
                <WrenchIcon /> Record status
              </Button>
            ) : null}
          </SheetFooter>
        ) : null}
        {s ? <StallStatusDialog stall={s} open={statusOpen} onOpenChange={setStatusOpen} /> : null}
      </SheetContent>
    </Sheet>
  )
}

export function StallStatusDialog({ stall, open, onOpenChange }: { stall: StallView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const mutation = useSetStallStatus()
  const [status, setStatus] = React.useState<StallStatus>(stall.status === 'occupied' ? 'vacant' : stall.status)
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState<string | undefined>()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record status of {stall.code}</DialogTitle>
          <DialogDescription>Use this for vacant stalls being reserved or repaired. Occupancy changes go through leases.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim().length < 5) {
              setError('Describe the reason (at least 5 characters).')
              return
            }
            mutation.mutate(
              { id: stall.id, status, note: note.trim() },
              {
                onSuccess: () => {
                  toast.success(`${stall.code} is now ${t.stallStatus[status].toLowerCase()}.`)
                  onOpenChange(false)
                  setNote('')
                },
              },
            )
          }}
        >
          <Field label="New status" htmlFor="stall-status">
            <NativeSelect id="stall-status" value={status} onChange={(e) => setStatus(e.target.value as StallStatus)}>
              <option value="vacant">{t.stallStatus.vacant}</option>
              <option value="reserved">{t.stallStatus.reserved}</option>
              <option value="under_repair">{t.stallStatus.under_repair}</option>
            </NativeSelect>
          </Field>
          <Field label="Note" htmlFor="stall-note" error={error} hint="For example the applicant's name or the repair being done.">
            <Textarea id="stall-note" value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'stall-note-error' : 'stall-note-hint'} />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t.common.saving : 'Save status'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
