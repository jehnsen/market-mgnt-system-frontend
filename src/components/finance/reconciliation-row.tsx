'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangleIcon, CheckCircle2Icon, ChevronDownIcon, CopyIcon, FileTextIcon, FlagIcon, HandCoinsIcon } from 'lucide-react'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { useCan } from '@/components/shared/role-gate'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/form-field'
import { Input, MoneyInput, Textarea } from '@/components/ui/input'
import { useFlagVariance, useMarkBalanced, useRecordRemittance } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatTime } from '@/lib/dates'
import { formatPeso, parsePeso, toPesoInput } from '@/lib/money'
import { cn, formatCount } from '@/lib/utils'
import type { ReconciliationDay, SerialUsage } from '@/types'
import { Amount } from './amount'

const formPrefix = (f: string) => (f === 'af51' ? 'OR' : 'CT')

/** "CT 0412001–0412047 · 47 used" plus gap/duplicate chips. */
export function SerialSummary({ serials }: { serials: SerialUsage[] }) {
  if (serials.length === 0) return <span className="text-[13px] text-ink-subtle">No forms used</span>
  return (
    <ul className="grid gap-1">
      {serials.map((s) => (
        <li key={s.formType} className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="num whitespace-nowrap">
            <span className="text-ink-muted">{formPrefix(s.formType)}</span> {s.first}–{s.last?.slice(-3)}
          </span>
          <span className="text-ink-muted">· {formatCount(s.count)} used</span>
          {s.gaps.length ? (
            <span className="inline-flex items-center gap-1 rounded bg-money-short-soft px-1.5 py-px font-semibold text-money-short">
              <AlertTriangleIcon className="size-3" aria-hidden /> {s.gaps.length} skipped
            </span>
          ) : null}
          {s.duplicates.length ? (
            <span className="inline-flex items-center gap-1 rounded bg-money-short-soft px-1.5 py-px font-semibold text-money-short">
              <CopyIcon className="size-3" aria-hidden /> {s.duplicates.length} duplicate
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** Serials used in order, gaps and duplicates highlighted. */
export function SerialSequence({ usage }: { usage: SerialUsage }) {
  const [all, setAll] = React.useState(false)
  const flaggedIdx = usage.sequence.map((s, i) => (s.gap || s.duplicate ? i : -1)).filter((i) => i >= 0)
  const shown = all ? usage.sequence : usage.sequence.filter((_, i) => i < 12 || i >= usage.sequence.length - 4 || flaggedIdx.some((f) => Math.abs(f - i) <= 2))
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-muted">
        {usage.formType === 'af51' ? 'Official receipts' : 'Cash tickets'} used in order{usage.issuedRange ? <> · series issued <span className="num">{usage.issuedRange}</span></> : null}
      </p>
      <ol className="flex flex-wrap gap-1" aria-label="Serial sequence">
        {shown.map((s, i) => {
          const prev = shown[i - 1]
          const skippedVisual = prev && usage.sequence.indexOf(s) - usage.sequence.indexOf(prev) > 1
          return (
            <React.Fragment key={`${s.collectionId}`}>
              {skippedVisual ? (
                <li aria-hidden className="px-1 text-xs text-ink-subtle">
                  …
                </li>
              ) : null}
              {s.gap ? (
                <li className="num rounded border border-dashed border-money-short px-1.5 py-0.5 text-[11.5px] text-money-short" title="Serial(s) missing before this one">
                  gap
                </li>
              ) : null}
              <li
                className={cn(
                  'num rounded border px-1.5 py-0.5 text-[11.5px]',
                  s.duplicate ? 'border-money-short bg-money-short-soft font-semibold text-money-short' : 'border-border bg-surface',
                )}
                title={`${formatPeso(s.amount)}${s.duplicate ? ' · duplicate serial' : ''}`}
              >
                {s.serial}
                {s.duplicate ? <span className="sr-only"> (duplicate)</span> : null}
              </li>
            </React.Fragment>
          )
        })}
      </ol>
      {usage.gaps.length ? (
        <p className="mt-1.5 text-xs text-money-short">
          Skipped: <span className="num">{usage.gaps.join(', ')}</span>
        </p>
      ) : null}
      {shown.length < usage.sequence.length ? (
        <button type="button" className="mt-1 text-xs text-primary underline underline-offset-2" onClick={() => setAll(true)}>
          Show all {usage.sequence.length}
        </button>
      ) : null}
    </div>
  )
}

export function ReconActions({ row, closed }: { row: ReconciliationDay; closed: boolean }) {
  const can = useCan()
  const [remitOpen, setRemitOpen] = React.useState(false)
  const [flagOpen, setFlagOpen] = React.useState(false)
  const mark = useMarkBalanced()
  const flag = useFlagVariance()
  if (closed) return <span className="text-[13px] text-ink-muted">Day closed</span>
  const hasRemit = row.remittances.length > 0
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {can('recon.recordRemittance') ? (
        <Button size="sm" variant={hasRemit ? 'ghost' : 'primary'} onClick={() => setRemitOpen(true)}>
          <HandCoinsIcon /> {hasRemit ? 'Add' : 'Record remittance'}
        </Button>
      ) : null}
      {can('recon.mark') && hasRemit && row.variance === 0 && row.status !== 'balanced' ? (
        <Button
          size="sm"
          variant="success"
          disabled={mark.isPending || row.pendingSyncCount > 0}
          title={row.pendingSyncCount > 0 ? 'Wait for the device to sync' : undefined}
          onClick={() => mark.mutate({ collectorId: row.collectorId, date: row.date }, { onSuccess: () => toast.success(`${row.collectorName} marked balanced.`) })}
        >
          <CheckCircle2Icon /> Mark balanced
        </Button>
      ) : null}
      {can('recon.mark') && hasRemit && row.variance !== 0 ? (
        <Button size="sm" variant={row.status === 'open' ? 'danger' : 'ghost'} onClick={() => setFlagOpen(true)}>
          <FlagIcon /> {row.status === 'open' ? `Flag ${row.variance < 0 ? 'shortage' : 'overage'}` : 'Edit flag'}
        </Button>
      ) : null}
      <RemittanceDialog row={row} open={remitOpen} onOpenChange={setRemitOpen} />
      <ReasonDialog
        open={flagOpen}
        onOpenChange={setFlagOpen}
        title={`Flag ${row.variance < 0 ? 'shortage' : 'overage'} of ${formatPeso(Math.abs(row.variance))}`}
        description={`${row.collectorName} · ${formatDate(row.date)}. Explain what happened and what was agreed. The explanation stays on the reconciliation record and in the audit log.`}
        label="Explanation"
        confirmLabel="Flag variance"
        tone="danger"
        minLength={10}
        pending={flag.isPending}
        onConfirm={(reason) =>
          flag.mutate(
            { collectorId: row.collectorId, date: row.date, reason },
            {
              onSuccess: () => {
                toast.success('Variance flagged.')
                setFlagOpen(false)
              },
            },
          )
        }
      />
    </div>
  )
}

function RemittanceDialog({ row, open, onOpenChange }: { row: ReconciliationDay; open: boolean; onOpenChange: (o: boolean) => void }) {
  const record = useRecordRemittance()
  const outstanding = Math.max(0, row.expected - row.remitted)
  const [amount, setAmount] = React.useState('')
  const [reference, setReference] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errors, setErrors] = React.useState<{ amount?: string; reference?: string }>({})
  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(toPesoInput(outstanding))
      setReference(`RCD-${row.date.replace(/-/g, '')}-`)
      setNotes('')
      setErrors({})
    }
  }, [open, outstanding, row.date])
  const parsed = parsePeso(amount)
  const afterVariance = parsed !== null ? row.remitted + parsed - row.expected : null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record remittance</DialogTitle>
          <DialogDescription>
            {row.collectorName} · {formatDate(row.date)} · recorded collections {formatPeso(row.expected)}
            {row.remitted ? `, already remitted ${formatPeso(row.remitted)}` : ''}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const next: typeof errors = {}
            if (parsed === null || parsed <= 0) next.amount = 'Enter the cash amount turned over.'
            if (reference.trim().length < 6) next.reference = 'Enter the RCD or deposit slip reference.'
            setErrors(next)
            if (Object.keys(next).length) return
            record.mutate(
              { collectorId: row.collectorId, date: row.date, amount: parsed ?? 0, reference: reference.trim(), notes },
              {
                onSuccess: (r) => {
                  toast.success(r.variance === 0 ? 'Remittance recorded. Collections and cash match.' : `Remittance recorded. Variance ${formatPeso(r.variance, { sign: 'always' })}.`)
                  onOpenChange(false)
                },
              },
            )
          }}
        >
          <Field label="Amount received" htmlFor="rem-amount" error={errors.amount} hint={afterVariance !== null ? (afterVariance === 0 ? 'Matches recorded collections.' : `Variance after this entry: ${formatPeso(afterVariance, { sign: 'always' })}`) : undefined}>
            <MoneyInput id="rem-amount" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'rem-amount-error' : 'rem-amount-hint'} />
          </Field>
          <Field label="Reference" htmlFor="rem-ref" error={errors.reference} hint="Report of Collections and Deposits number or bank deposit slip.">
            <Input id="rem-ref" className="num" value={reference} onChange={(e) => setReference(e.target.value)} aria-invalid={Boolean(errors.reference)} aria-describedby={errors.reference ? 'rem-ref-error' : 'rem-ref-hint'} />
          </Field>
          <Field label="Notes" htmlFor="rem-notes" optional>
            <Textarea id="rem-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {row.pendingSyncCount > 0 ? (
            <p className="rounded-md bg-accent-soft px-3 py-2 text-[13px]">{row.pendingSyncCount} entries are still on the collector&apos;s phone and are included in the recorded total. Ask the collector to sync before closing.</p>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? t.common.saving : 'Record remittance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Expected vs remitted vs variance for one collector-day, with expandable detail. */
export function ReconciliationRow({ row, closed, desktop }: { row: ReconciliationDay; closed: boolean; desktop: boolean }) {
  const [open, setOpen] = React.useState(false)
  const id = `recon-${row.collectorId}`
  const hasRemit = row.remittances.length > 0
  const variance = hasRemit ? <Amount value={row.variance} signed positiveTone dashZero className="font-semibold" /> : <span className="text-[13px] text-ink-muted">Awaiting remittance</span>
  const status = (
    <span className="flex flex-wrap items-center gap-1">
      <StatusBadge kind="recon" value={row.status} />
      {row.status === 'closed' && row.statusBeforeClose && row.statusBeforeClose !== 'balanced' && row.statusBeforeClose !== 'open' ? <StatusBadge kind="recon" value={row.statusBeforeClose} /> : null}
    </span>
  )
  const toggle = (
    <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${id}-detail`} className="flex items-center gap-2 text-left font-medium hover:underline">
      <ChevronDownIcon className={cn('size-4 shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden />
      <span>
        {row.collectorName}
        <span className="block text-xs font-normal text-ink-muted">{row.sectionNames.join(', ')}</span>
      </span>
    </button>
  )
  const detail = (
    <div id={`${id}-detail`} className="grid gap-5 bg-surface-muted/40 px-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="grid gap-4">
        {row.serials.map((s) => (
          <SerialSequence key={s.formType} usage={s} />
        ))}
        {row.pendingSyncCount > 0 ? <p className="text-[13px] font-medium text-accent-ink">{row.pendingSyncCount} entries not yet synced from the device.</p> : null}
      </div>
      <div className="grid content-start gap-3 text-sm">
        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted">Remittances</p>
          {hasRemit ? (
            <ul className="grid gap-1">
              {row.remittances.map((r) => (
                <li key={r.id} className="flex justify-between gap-3">
                  <span>
                    <span className="num text-[12.5px]">{r.reference}</span>
                    <span className="block text-xs text-ink-muted">
                      {formatTime(r.receivedAt)} · {r.receivedByName}
                    </span>
                  </span>
                  <Amount value={r.amount} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">None recorded yet.</p>
          )}
        </div>
        {row.flagReason ? (
          <div>
            <p className="mb-1 text-xs font-medium text-ink-muted">Explanation</p>
            <p>{row.flagReason}</p>
          </div>
        ) : null}
        {row.markedByName ? <p className="text-xs text-ink-muted">Last marked by {row.markedByName}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Link href={`/app/collections?from=${row.date}&to=${row.date}`} className="text-[13px] text-primary hover:underline">
            View {formatCount(row.collectionsCount)} collections →
          </Link>
          <Link href={`/app/reconciliation/report?collector=${row.collectorId}&date=${row.date}`} className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline">
            <FileTextIcon className="size-3.5" aria-hidden /> Report of collections
          </Link>
        </div>
      </div>
    </div>
  )

  if (!desktop) {
    return (
      <li className="border-b border-border">
        <div className="grid gap-3 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            {toggle}
            {status}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-[13px]">
            <div>
              <dt className="text-xs text-ink-muted">Recorded</dt>
              <dd>
                <Amount value={row.expected} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Remitted</dt>
              <dd>{hasRemit ? <Amount value={row.remitted} /> : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Variance</dt>
              <dd>{variance}</dd>
            </div>
          </dl>
          <SerialSummary serials={row.serials} />
          <ReconActions row={row} closed={closed} />
        </div>
        {open ? detail : null}
      </li>
    )
  }

  return (
    <>
      <tr className={cn('align-top', row.variance !== 0 && hasRemit && row.status === 'open' && 'bg-money-short-soft/40')}>
        <td className="border-b border-border px-3 py-3">{toggle}</td>
        <td className="num border-b border-border px-3 py-3 text-right">{formatCount(row.collectionsCount)}</td>
        <td className="border-b border-border px-3 py-3 text-right">
          <Amount value={row.expected} />
        </td>
        <td className="border-b border-border px-3 py-3 text-right">{hasRemit ? <Amount value={row.remitted} /> : <span className="text-ink-subtle">—</span>}</td>
        <td className="border-b border-border px-3 py-3 text-right">{variance}</td>
        <td className="border-b border-border px-3 py-3">
          <SerialSummary serials={row.serials} />
        </td>
        <td className="border-b border-border px-3 py-3">{status}</td>
        <td className="border-b border-border px-3 py-3">
          <ReconActions row={row} closed={closed} />
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={8} className="border-b border-border p-0">
            {detail}
          </td>
        </tr>
      ) : null}
    </>
  )
}
