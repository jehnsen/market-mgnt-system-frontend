'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckIcon, InfoIcon, PencilLineIcon, XIcon } from 'lucide-react'
import { useCan } from '@/components/shared/role-gate'
import { Notice } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/form-field'
import { MoneyInput, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { marketName } from '@/config/lgu'
import { useCollection, useRequestCorrection, useReviewCorrection } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatDateTime } from '@/lib/dates'
import { formatPeso, parsePeso } from '@/lib/money'
import type { CollectionView } from '@/types'
import { Amount, SerialNumber, StallCode } from './amount'

export function CollectionTags({ c }: { c: CollectionView }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <StatusBadge kind="collection" value={c.status} />
      {c.correctionStatus === 'pending' || (c.correctedByCollectionId && c.status !== 'corrected') ? <StatusBadge kind="correction" value="pending" /> : null}
      {c.correctionStatus === 'rejected' ? <StatusBadge kind="correction" value="rejected" /> : null}
      {c.isDuplicateSerial ? <span className="rounded-md bg-money-short-soft px-1.5 py-0.5 text-[11px] font-semibold text-money-short">Duplicate serial</span> : null}
    </span>
  )
}

export function CollectionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useCollection(id)
  const can = useCan()
  const [correcting, setCorrecting] = React.useState(false)
  const review = useReviewCorrection()
  const [note, setNote] = React.useState('')
  const c = q.data?.collection
  const isCorrection = Boolean(c?.correctsCollectionId)
  const hasOpenCorrection = q.data?.linked.some((x) => x.correctsCollectionId === c?.id && x.correctionStatus !== 'rejected')

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isCorrection ? 'Correcting entry' : 'Collection'}</SheetTitle>
          <SheetDescription className="num break-all">{id}</SheetDescription>
        </SheetHeader>
        <SheetBody className="grid content-start gap-5">
          {!c ? (
            <div className="grid gap-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-muted">{isCorrection ? 'Adjustment' : 'Amount'}</p>
                  <Amount value={c.amount} signed={isCorrection} size="lg" className="text-2xl" />
                  {isCorrection && c.correctionStatus !== 'approved' ? <p className="text-xs text-ink-muted">Not counted in totals until approved.</p> : null}
                </div>
                <CollectionTags c={c} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Receipt / ticket</dt>
                  <dd>
                    <SerialNumber serial={c.receiptSerial} formType={c.formType} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Type</dt>
                  <dd>{t.collectionType[c.type]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Business date</dt>
                  <dd>{formatDate(c.businessDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Collector</dt>
                  <dd>
                    <Link href={`/app/collectors/${c.collectorId}`} className="text-primary hover:underline">
                      {c.collectorName}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Market · section</dt>
                  <dd>
                    {marketName(c.marketId, true)} · {c.sectionName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">{c.stallCode ? 'Stall · lessee' : 'Payer'}</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    {c.stallCode ? <StallCode code={c.stallCode} /> : null}
                    {c.lesseeId ? (
                      <Link href={`/app/lessees/${c.lesseeId}`} className="hover:underline">
                        {c.payerName}
                      </Link>
                    ) : (
                      c.payerName
                    )}
                  </dd>
                </div>
                {c.transientGoods || c.remarks ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-ink-muted">Details</dt>
                    <dd>{c.transientGoods ?? c.remarks}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs text-ink-muted">{isCorrection ? 'Requested at' : 'Recorded on device at'}</dt>
                  <dd>{formatDateTime(c.recordedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Synced at</dt>
                  <dd>{c.syncedAt ? formatDateTime(c.syncedAt) : <span className="text-accent-ink">Still on the device</span>}</dd>
                </div>
              </dl>

              {isCorrection ? (
                <section className="rounded-md border border-border p-3 text-sm">
                  <p>
                    <span className="text-xs text-ink-muted">Reason</span>
                    <br />
                    {c.correctionReason}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    Requested by {c.correctionRequestedBy}
                    {c.correctionReviewedBy ? ` · ${c.correctionStatus === 'approved' ? 'approved' : 'rejected'} by ${c.correctionReviewedBy} on ${formatDateTime(c.correctionReviewedAt)}` : ' · awaiting the Treasurer'}
                  </p>
                  {c.correctionReviewNote ? <p className="mt-1 text-xs">Note: {c.correctionReviewNote}</p> : null}
                </section>
              ) : null}

              {q.data?.linked.length ? (
                <section aria-labelledby="linked-entries">
                  <h3 id="linked-entries" className="mb-2 text-sm font-semibold">
                    Linked entries
                  </h3>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {q.data.linked.map((x) => (
                      <li key={x.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="block">{x.correctsCollectionId ? 'Correcting entry' : 'Original entry'}</span>
                          <span className="num block truncate text-xs text-ink-muted">{x.id}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Amount value={x.amount} signed={Boolean(x.correctsCollectionId)} />
                          <CollectionTags c={x} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <Notice tone="info" icon={<InfoIcon />}>
                {t.notices.marcisNoOr}
              </Notice>
              <p className="text-xs text-ink-muted">{t.notices.appendOnly}</p>
            </>
          )}
        </SheetBody>
        {c ? (
          <SheetFooter>
            {can('collections.requestCorrection') && !isCorrection && !hasOpenCorrection ? (
              <Button variant="secondary" size="sm" onClick={() => setCorrecting(true)}>
                <PencilLineIcon /> Request correction
              </Button>
            ) : null}
            {can('collections.approveCorrection') && isCorrection && c.correctionStatus === 'pending' ? (
              <div className="grid w-full gap-2">
                <Field label="Decision note" htmlFor="review-note" optional>
                  <Textarea id="review-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: verified against the ticket stub." />
                </Field>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: c.id, approve: true, note }, { onSuccess: () => toast.success('Correction approved. Totals now include the adjustment.') })}
                  >
                    <CheckIcon /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: c.id, approve: false, note }, { onSuccess: () => toast.success('Correction rejected. The original amount stands.') })}
                  >
                    <XIcon /> Reject
                  </Button>
                </div>
              </div>
            ) : null}
            {isCorrection && c.correctionStatus === 'pending' && !can('collections.approveCorrection') ? <p className="text-[13px] text-ink-muted">Awaiting the Treasurer&apos;s approval.</p> : null}
          </SheetFooter>
        ) : null}
        {c ? <CorrectionDialog collection={c} open={correcting} onOpenChange={setCorrecting} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function CorrectionDialog({ collection, open, onOpenChange }: { collection: CollectionView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const request = useRequestCorrection()
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [errors, setErrors] = React.useState<{ amount?: string; reason?: string }>({})
  const parsed = parsePeso(amount)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a correction</DialogTitle>
          <DialogDescription>
            The original entry ({formatPeso(collection.amount)}, serial {collection.receiptSerial}) is kept as is. A linked correcting entry is added for the difference and needs the Treasurer&apos;s approval.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const next: typeof errors = {}
            if (parsed === null || parsed < 0) next.amount = 'Enter the correct amount on the receipt or ticket.'
            else if (parsed === collection.amount) next.amount = 'This is the same as the recorded amount.'
            if (reason.trim().length < 10) next.reason = 'Explain the correction (at least 10 characters).'
            setErrors(next)
            if (Object.keys(next).length) return
            request.mutate(
              { id: collection.id, correctedAmount: parsed ?? 0, reason: reason.trim() },
              {
                onSuccess: () => {
                  toast.success('Correction requested. The Treasurer has been notified.')
                  onOpenChange(false)
                  setAmount('')
                  setReason('')
                },
              },
            )
          }}
        >
          <Field label="Correct amount" htmlFor="corr-amount" error={errors.amount} hint={parsed !== null && parsed !== collection.amount ? `Adjustment: ${formatPeso(parsed - collection.amount, { sign: 'always' })}` : undefined}>
            <MoneyInput id="corr-amount" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'corr-amount-error' : 'corr-amount-hint'} />
          </Field>
          <Field label="Reason" htmlFor="corr-reason" error={errors.reason}>
            <Textarea id="corr-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? 'corr-reason-error' : undefined} placeholder="What was wrong and how it was verified." />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={request.isPending}>
              {request.isPending ? t.common.saving : 'Submit for approval'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
