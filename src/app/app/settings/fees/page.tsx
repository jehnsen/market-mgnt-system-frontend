'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { HistoryIcon, PencilIcon } from 'lucide-react'
import { Amount } from '@/components/finance/amount'
import { SectionTitle } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { ErrorState, Notice, PageSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/form-field'
import { Input, MoneyInput, Textarea } from '@/components/ui/input'
import { marketName } from '@/config/lgu'
import { SECTION_CATEGORY_LABEL } from '@/config/markets'
import { useCreateFeeVersion, useFeeSchedules } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { addDays, formatDate } from '@/lib/dates'
import { formatBps, formatPeso, parsePeso, toPesoInput } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { FeeKind, FeeRate } from '@/types'

const KIND_LABEL: Record<FeeKind, string> = { monthly_rental: 'Monthly stall rental', daily_fee: 'Daily market fee (per stall)', transient_fee: 'Transient seller fee (per day)' }

export default function FeesPage() {
  return (
    <RoleGate permission="settings.fees" page="the fee schedule">
      <Fees />
    </RoleGate>
  )
}

function Fees() {
  const q = useFeeSchedules()
  const { today } = useAppContext()
  const create = useCreateFeeVersion()
  const [editing, setEditing] = React.useState(false)
  const [amounts, setAmounts] = React.useState<Record<string, string>>({})
  const [effective, setEffective] = React.useState(addDays(today, 30))
  const [ordinance, setOrdinance] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [penalty, setPenalty] = React.useState('2')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  if (q.isLoading) return <PageSkeleton />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />
  const current = q.data.schedules[0]!
  const rates = q.data.rates.filter((r) => r.scheduleId === current.id)
  const byKind = (['monthly_rental', 'daily_fee', 'transient_fee'] as FeeKind[]).map((k) => ({ kind: k, rates: rates.filter((r) => r.kind === k) }))

  const startEdit = () => {
    setAmounts(Object.fromEntries(rates.map((r) => [r.id, toPesoInput(r.amount)])))
    setPenalty(String(current.penaltyRateBps / 100))
    setEditing(true)
  }

  const save = () => {
    const e: Record<string, string> = {}
    if (effective <= current.effectiveFrom) e.effective = `Must be after ${formatDate(current.effectiveFrom)}.`
    if (ordinance.trim().length < 8) e.ordinance = 'Cite the ordinance or resolution, e.g. "Municipal Ordinance No. 2026-09, Sec. 2".'
    const bps = Math.round(Number(penalty) * 100)
    if (!Number.isFinite(bps) || bps < 0 || bps > 2500) e.penalty = 'Enter a rate from 0 to 25.'
    const changes = []
    for (const r of rates) {
      const v = parsePeso(amounts[r.id] ?? '')
      if (v === null || v <= 0) e[r.id] = 'Invalid amount'
      else if (v !== r.amount) changes.push({ rateId: r.id, amount: v })
    }
    setErrors(e)
    if (Object.keys(e).length) return
    create.mutate(
      { effectiveFrom: effective, ordinanceRef: ordinance.trim(), notes, changes, penaltyRateBps: bps },
      {
        onSuccess: (s) => {
          toast.success(`Fee schedule v${s.version} created, effective ${formatDate(s.effectiveFrom)}.`)
          setEditing(false)
        },
      },
    )
  }

  const label = (r: FeeRate) => `${marketName(r.marketId, true)} · ${SECTION_CATEGORY_LABEL[r.sectionCategory]}${r.stallType ? ` · ${r.stallType}` : ''}${r.label ? ` · ${r.label}` : ''}`

  return (
    <div className="grid gap-6">
      <SectionTitle action={!editing ? <Button onClick={startEdit}><PencilIcon /> Propose new rates</Button> : null}>Fee schedule</SectionTitle>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              Version {current.version} <Badge tone="green">In effect</Badge>
            </CardTitle>
            <CardDescription>
              {current.ordinanceRef} · effective {formatDate(current.effectiveFrom)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="grid gap-2 text-sm">
          <p>
            <span className="num text-lg font-semibold">{formatBps(current.penaltyRateBps)}</span> surcharge per month on overdue rental · {current.penaltyOrdinanceRef}
          </p>
          <p className="text-ink-muted">{current.penaltyRule}</p>
        </CardBody>
      </Card>

      {editing ? (
        <Card className="border-primary">
          <CardHeader>
            <div>
              <CardTitle>New version {current.version + 1}</CardTitle>
              <CardDescription>Changing a rate creates a new version. Charges already billed keep their old rate; existing leases keep their contracted rate until renewed.</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Effective from" htmlFor="fv-eff" error={errors.effective}>
              <Input id="fv-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
            </Field>
            <Field label="Ordinance / resolution" htmlFor="fv-ord" error={errors.ordinance} className="sm:col-span-2">
              <Input id="fv-ord" value={ordinance} onChange={(e) => setOrdinance(e.target.value)} placeholder="Municipal Ordinance No. 2026-09, Sec. 2" />
            </Field>
            <Field label="Surcharge (% per month)" htmlFor="fv-pen" error={errors.penalty}>
              <Input id="fv-pen" inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} className="num" />
            </Field>
            <Field label="Notes" htmlFor="fv-notes" optional className="sm:col-span-2">
              <Textarea id="fv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </CardBody>
        </Card>
      ) : null}

      {byKind.map((g) => (
        <Card key={g.kind}>
          <CardHeader>
            <CardTitle>{KIND_LABEL[g.kind]}</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="border-b border-border bg-surface-muted px-4 py-2 font-semibold">Applies to</th>
                  <th className="border-b border-border bg-surface-muted px-4 py-2 text-right font-semibold">Rate</th>
                  <th className="border-b border-border bg-surface-muted px-4 py-2 font-semibold">Ordinance reference</th>
                  <th className="border-b border-border bg-surface-muted px-4 py-2 text-right font-semibold">Previous rate</th>
                </tr>
              </thead>
              <tbody>
                {g.rates.map((r) => {
                  const prev = q.data.rates.find((x) => x.scheduleId === q.data.schedules[1]?.id && x.marketId === r.marketId && x.sectionCategory === r.sectionCategory && x.stallType === r.stallType && x.kind === r.kind && x.label === r.label)
                  return (
                    <tr key={r.id}>
                      <td className="border-b border-border px-4 py-2">{label(r)}</td>
                      <td className="border-b border-border px-4 py-2 text-right">
                        {editing ? (
                          <div className="ml-auto w-36">
                            <MoneyInput aria-label={`New rate for ${label(r)}`} value={amounts[r.id] ?? ''} onChange={(e) => setAmounts({ ...amounts, [r.id]: e.target.value })} className={cn('h-8', errors[r.id] && 'border-money-short')} aria-invalid={Boolean(errors[r.id])} />
                          </div>
                        ) : (
                          <Amount value={r.amount} className="font-medium" />
                        )}
                      </td>
                      <td className="border-b border-border px-4 py-2 text-[13px] text-ink-muted">{r.ordinanceRef}</td>
                      <td className="border-b border-border px-4 py-2 text-right text-ink-muted">{prev ? <Amount value={prev.amount} /> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {editing && g.kind === 'transient_fee' ? (
            <CardFooter>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={save} disabled={create.isPending}>
                {create.isPending ? t.common.saving : `Create version ${current.version + 1}`}
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      ))}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HistoryIcon className="size-4 text-ink-muted" aria-hidden />
            <CardTitle>Rate history</CardTitle>
          </div>
        </CardHeader>
        <ul className="divide-y divide-border">
          {q.data.schedules.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">
                  v{s.version} · {s.name}
                </p>
                <p className="text-[13px] text-ink-muted">{s.ordinanceRef}</p>
                {s.notes ? <p className="text-[13px] text-ink-muted">{s.notes}</p> : null}
              </div>
              <div className="text-right text-[13px]">
                <p>
                  {formatDate(s.effectiveFrom)} – {s.effectiveTo ? formatDate(s.effectiveTo) : 'present'}
                </p>
                <p className="text-ink-muted">
                  Surcharge {formatBps(s.penaltyRateBps)} · by {s.createdByName}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Notice tone="info">Ordinance references shown here are sample citations for this demonstration. Example: a stall at {formatPeso(rates.find((r) => r.kind === 'monthly_rental')?.amount ?? 0)} a month.</Notice>
    </div>
  )
}
