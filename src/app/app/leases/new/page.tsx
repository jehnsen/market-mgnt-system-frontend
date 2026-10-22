'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PrinterIcon, SearchIcon } from 'lucide-react'
import { LeaseContract } from '@/components/documents/lease-contract'
import { Amount, StallCode } from '@/components/finance/amount'
import { LesseeForm } from '@/components/market/lessee-form'
import { StallLegend } from '@/components/market/stall-map'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { Notice } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem, Segmented } from '@/components/ui/controls'
import { Field, Label } from '@/components/ui/form-field'
import { Input, MoneyInput, NativeSelect, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { lguConfig, marketName } from '@/config/lgu'
import { useCreateLease, useLessees, useMarkets, useRateQuote, useSections, useStalls } from '@/hooks/api'
import { t } from '@/i18n'
import type { LesseeInput } from '@/lib/api'
import { useAppContext } from '@/lib/app-context'
import { addDays, addMonths, formatDate } from '@/lib/dates'
import { formatPeso, parsePeso, toPesoInput } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { ISODate, StallView } from '@/types'

const StallMap = dynamic(() => import('@/components/market/stall-map').then((m) => m.StallMap), { ssr: false, loading: () => <Skeleton className="h-[380px] w-full" /> })

const STEPS = ['Stall', 'Lessee', 'Terms', 'Review'] as const

interface Terms {
  startDate: ISODate
  termMonths: number
  monthlyRate: string
  deposit: string
  specialConditions: string
}

export default function NewLeasePage() {
  return (
    <RoleGate permission="leases.manage" page="lease creation">
      <React.Suspense>
        <Wizard />
      </React.Suspense>
    </RoleGate>
  )
}

function Wizard() {
  const params = useSearchParams()
  const router = useRouter()
  const { today } = useAppContext()
  const [step, setStep] = React.useState(0)
  const [stall, setStall] = React.useState<StallView | null>(null)
  const [lesseeMode, setLesseeMode] = React.useState<'existing' | 'new'>('existing')
  const [lesseeId, setLesseeId] = React.useState<string | null>(null)
  const [newLessee, setNewLessee] = React.useState<LesseeInput | null>(null)
  const [terms, setTerms] = React.useState<Terms>({ startDate: today, termMonths: 12, monthlyRate: '', deposit: '', specialConditions: '' })
  const [termErrors, setTermErrors] = React.useState<Partial<Record<keyof Terms, string>>>({})
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  const stalls = useStalls({ market: 'all' })
  const lessees = useLessees({ market: 'all' })
  const quote = useRateQuote(stall?.id ?? null, terms.startDate)
  const create = useCreateLease()

  // Pre-select the stall passed in the URL.
  React.useEffect(() => {
    const pre = params.get('stall')
    if (!pre || stall || !stalls.data) return
    const s = stalls.data.find((x) => x.id === pre && (x.status === 'vacant' || x.status === 'reserved'))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s) setStall(s)
  }, [params, stalls.data, stall])

  // Pre-fill the rate and deposit from the fee schedule.
  React.useEffect(() => {
    if (!quote.data) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTerms((t0) => (t0.monthlyRate ? t0 : { ...t0, monthlyRate: toPesoInput(quote.data.rate.amount), deposit: toPesoInput(quote.data.rate.amount * 2) }))
  }, [quote.data])

  React.useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const go = (n: number) => setStep(n)

  const validateTerms = () => {
    const e: Partial<Record<keyof Terms, string>> = {}
    if (!terms.startDate) e.startDate = 'Choose a start date.'
    else if (terms.startDate < addDays(today, -31)) e.startDate = 'Start date cannot be more than a month in the past.'
    if (!Number.isInteger(terms.termMonths) || terms.termMonths < 1 || terms.termMonths > 60) e.termMonths = 'Term must be 1 to 60 months.'
    const rate = parsePeso(terms.monthlyRate)
    if (rate === null || rate <= 0) e.monthlyRate = 'Enter the monthly rental, e.g. 1,800.00.'
    const dep = parsePeso(terms.deposit)
    if (dep === null || dep < 0) e.deposit = 'Enter the deposit (0 if none).'
    setTermErrors(e)
    return Object.keys(e).length === 0
  }

  const lesseeName = lesseeMode === 'existing' ? (lessees.data?.find((l) => l.id === lesseeId)?.fullName ?? '') : newLessee ? `${newLessee.firstName}${newLessee.middleInitial ? ` ${newLessee.middleInitial.replace('.', '')}.` : ''} ${newLessee.lastName}` : ''
  const lesseeAddress = lesseeMode === 'existing' ? (lessees.data?.find((l) => l.id === lesseeId)?.address ?? '') : (newLessee?.address ?? '')

  const submit = () => {
    if (!stall) return
    create.mutate(
      {
        stallId: stall.id,
        lesseeId: lesseeMode === 'existing' ? lesseeId : null,
        newLessee: lesseeMode === 'new' ? newLessee : null,
        startDate: terms.startDate,
        termMonths: terms.termMonths,
        monthlyRate: parsePeso(terms.monthlyRate) ?? 0,
        deposit: parsePeso(terms.deposit) ?? 0,
        specialConditions: terms.specialConditions,
      },
      {
        onSuccess: (lease) => {
          toast.success(`Lease ${lease.leaseNo} created for stall ${lease.stallCode}.`)
          router.push(`/app/leases/${lease.id}`)
        },
      },
    )
  }

  return (
    <>
      <PageHeader title={t.pages.newLease.title} description={t.pages.newLease.description} />
      <nav aria-label="Progress" className="no-print mb-6">
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
                  i === step ? 'border-primary bg-primary-soft font-semibold text-ink' : i < step ? 'border-border text-ink' : 'border-border text-ink-muted',
                )}
              >
                <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px] font-bold', i < step ? 'bg-money-in text-white' : i === step ? 'bg-primary text-primary-ink' : 'bg-surface-muted')}>
                  {i < step ? <CheckIcon className="size-3" aria-hidden /> : i + 1}
                </span>
                {label}
                {i < step ? <span className="sr-only">(done)</span> : null}
              </span>
              {i < STEPS.length - 1 ? <span aria-hidden className="h-px w-4 bg-border sm:w-8" /> : null}
            </li>
          ))}
        </ol>
      </nav>

      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Step {step + 1} of 4: {STEPS[step]}
      </h2>

      {step === 0 ? <StepStall stalls={stalls.data} selected={stall} onSelect={setStall} onNext={() => go(1)} /> : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Who will lease stall {stall?.code}?</CardTitle>
              <CardDescription>Choose a registered lessee or register a new one.</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="grid gap-5">
            <Segmented
              label="Lessee"
              value={lesseeMode}
              onChange={setLesseeMode}
              options={[
                { value: 'existing', label: 'Existing lessee' },
                { value: 'new', label: 'New lessee' },
              ]}
            />
            {lesseeMode === 'existing' ? (
              <LesseePicker lessees={lessees.data ?? []} value={lesseeId} onChange={setLesseeId} />
            ) : (
              <LesseeForm
                formId="wizard-lessee"
                defaultValues={newLessee ?? undefined}
                onSubmit={(v) => {
                  setNewLessee(v)
                  go(2)
                }}
              />
            )}
          </CardBody>
          <CardFooter className="justify-between">
            <Button variant="secondary" onClick={() => go(0)}>
              <ChevronLeftIcon /> {t.common.back}
            </Button>
            {lesseeMode === 'existing' ? (
              <Button onClick={() => go(2)} disabled={!lesseeId}>
                {t.common.next} <ChevronRightIcon />
              </Button>
            ) : (
              <Button type="submit" form="wizard-lessee">
                {t.common.next} <ChevronRightIcon />
              </Button>
            )}
          </CardFooter>
        </Card>
      ) : null}

      {step === 2 && stall ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Lease terms</CardTitle>
              <CardDescription>
                Stall <span className="num">{stall.code}</span> · {stall.sectionName} · {lesseeName}
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody className="grid gap-5">
            {quote.data ? (
              <Notice tone="info">
                Schedule rate for a {stall.type} stall in {stall.sectionName}: <strong className="num">{formatPeso(quote.data.rate.amount)}</strong> a month under <strong>{quote.data.rate.ordinanceRef}</strong> ({quote.data.schedule.ordinanceRef}).
              </Notice>
            ) : (
              <Skeleton className="h-12" />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date" htmlFor="t-start" error={termErrors.startDate}>
                <Input id="t-start" type="date" value={terms.startDate} onChange={(e) => setTerms({ ...terms, startDate: e.target.value })} aria-invalid={Boolean(termErrors.startDate)} />
              </Field>
              <Field label="Term" htmlFor="t-term" error={termErrors.termMonths} hint={terms.startDate ? `Ends ${formatDate(addDays(addMonths(terms.startDate, terms.termMonths), -1))}` : undefined}>
                <NativeSelect id="t-term" value={terms.termMonths} onChange={(e) => setTerms({ ...terms, termMonths: Number(e.target.value) })} aria-describedby="t-term-hint">
                  {[6, 12, 24, 36, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} months{m === 12 ? ' (standard)' : ''}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label="Monthly rental"
                htmlFor="t-rate"
                error={termErrors.monthlyRate}
                hint={quote.data && parsePeso(terms.monthlyRate) !== null && parsePeso(terms.monthlyRate) !== quote.data.rate.amount ? 'Differs from the schedule rate. Note the basis under special conditions.' : 'Pre-filled from the fee schedule.'}
              >
                <MoneyInput id="t-rate" value={terms.monthlyRate} onChange={(e) => setTerms({ ...terms, monthlyRate: e.target.value })} aria-invalid={Boolean(termErrors.monthlyRate)} aria-describedby={termErrors.monthlyRate ? 't-rate-error' : 't-rate-hint'} />
              </Field>
              <Field label="Deposit" htmlFor="t-dep" error={termErrors.deposit} hint="Usually two months' rental.">
                <MoneyInput id="t-dep" value={terms.deposit} onChange={(e) => setTerms({ ...terms, deposit: e.target.value })} aria-invalid={Boolean(termErrors.deposit)} aria-describedby={termErrors.deposit ? 't-dep-error' : 't-dep-hint'} />
              </Field>
            </div>
            <Field label="Special conditions" htmlFor="t-cond" optional>
              <Textarea id="t-cond" rows={3} value={terms.specialConditions} onChange={(e) => setTerms({ ...terms, specialConditions: e.target.value })} placeholder="For example: chiller electricity billed through the sub-meter." />
            </Field>
          </CardBody>
          <CardFooter className="justify-between">
            <Button variant="secondary" onClick={() => go(1)}>
              <ChevronLeftIcon /> {t.common.back}
            </Button>
            <Button onClick={() => validateTerms() && go(3)}>
              Review contract <ChevronRightIcon />
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {step === 3 && stall && quote.data ? (
        <div className="grid gap-6">
          <Card className="no-print">
            <CardHeader>
              <div>
                <CardTitle>Review</CardTitle>
                <CardDescription>Check the details, print the draft contract for signing, then create the lease.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink-muted">Stall</dt>
                  <dd className="flex items-center gap-2">
                    <StallCode code={stall.code} /> {marketName(stall.marketId, true)} · {stall.sectionName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Lessee</dt>
                  <dd>
                    {lesseeName} {lesseeMode === 'new' ? <span className="text-xs text-ink-muted">(new registration)</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Period</dt>
                  <dd>
                    {formatDate(terms.startDate)} – {formatDate(addDays(addMonths(terms.startDate, terms.termMonths), -1))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Monthly rental</dt>
                  <dd>
                    <Amount value={parsePeso(terms.monthlyRate) ?? 0} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Deposit</dt>
                  <dd>
                    <Amount value={parsePeso(terms.deposit) ?? 0} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Rate basis</dt>
                  <dd>{quote.data.rate.ordinanceRef}</dd>
                </div>
              </dl>
            </CardBody>
            <CardFooter className="justify-between">
              <Button variant="secondary" onClick={() => go(2)}>
                <ChevronLeftIcon /> {t.common.back}
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => window.print()}>
                  <PrinterIcon /> Print draft
                </Button>
                <Button onClick={submit} disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create lease'}
                </Button>
              </div>
            </CardFooter>
          </Card>
          <LeaseContract
            draft
            data={{
              leaseNo: null,
              lesseeName,
              lesseeAddress,
              stallCode: stall.code,
              marketId: stall.marketId,
              sectionName: stall.sectionName,
              sizeSqm: stall.sizeSqm,
              startDate: terms.startDate,
              termMonths: terms.termMonths,
              monthlyRate: parsePeso(terms.monthlyRate) ?? 0,
              deposit: parsePeso(terms.deposit) ?? 0,
              specialConditions: terms.specialConditions,
              schedule: quote.data.schedule,
              rateOrdinanceRef: quote.data.rate.ordinanceRef,
            }}
          />
        </div>
      ) : null}
      <p className="mt-6 text-xs text-ink-muted no-print">{lguConfig.officeName}</p>
    </>
  )
}

function StepStall({ stalls, selected, onSelect, onNext }: { stalls: StallView[] | undefined; selected: StallView | null; onSelect: (s: StallView) => void; onNext: () => void }) {
  const { market } = useAppContext()
  const markets = useMarkets()
  const [marketId, setMarketId] = React.useState(market === 'all' ? 'pm' : market)
  const sections = useSections(marketId)
  const mkt = markets.data?.find((m) => m.id === marketId)
  const inMarket = (stalls ?? []).filter((s) => s.marketId === marketId)
  const available = inMarket.filter((s) => s.status === 'vacant' || s.status === 'reserved')
  const matches = React.useMemo(() => new Set(available.map((s) => s.id)), [available])
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Choose a vacant stall</CardTitle>
          <CardDescription>Only vacant and reserved stalls can be leased. Others are dimmed.</CardDescription>
        </div>
        <Segmented label="Market" value={marketId} onChange={setMarketId} options={lguConfig.markets.map((m) => ({ value: m.id, label: m.shortName }))} />
      </CardHeader>
      <CardBody className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <StallLegend className="mb-3" />
          {mkt && sections.data && stalls ? (
            <StallMap
              market={mkt}
              sections={sections.data}
              stalls={inMarket}
              matches={matches}
              selectedId={selected?.id}
              onSelect={(s) => {
                if (s.status === 'vacant' || s.status === 'reserved') onSelect(s)
                else toast.info(`${s.code} is ${t.stallStatus[s.status].toLowerCase()} and cannot be leased.`)
              }}
              height={380}
            />
          ) : (
            <Skeleton className="h-[380px]" />
          )}
        </div>
        <div>
          <Label htmlFor="stall-select">Or pick from the list</Label>
          <NativeSelect id="stall-select" className="mt-1.5" value={selected?.marketId === marketId ? selected.id : ''} onChange={(e) => {
            const s = available.find((x) => x.id === e.target.value)
            if (s) onSelect(s)
          }}>
            <option value="">{available.length} available stalls…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.sectionName} · {t.stallStatus[s.status]}
              </option>
            ))}
          </NativeSelect>
          {selected ? (
            <div className="mt-4 rounded-md border border-accent bg-accent-soft/50 p-3 text-sm" aria-live="polite">
              <p className="flex items-center gap-2 font-medium">
                Selected <StallCode code={selected.code} />
              </p>
              <p className="mt-1 text-ink-muted">
                {marketName(selected.marketId, true)} · {selected.sectionName} · {selected.sizeSqm} m² {selected.type}
              </p>
              <div className="mt-2">
                <StatusBadge kind="stall" value={selected.status} />
              </div>
            </div>
          ) : null}
        </div>
      </CardBody>
      <CardFooter>
        <Button onClick={onNext} disabled={!selected}>
          {t.common.next} <ChevronRightIcon />
        </Button>
      </CardFooter>
    </Card>
  )
}

function LesseePicker({ lessees, value, onChange }: { lessees: { id: string; fullName: string; businessName: string | null; stallCodes: string[]; balance: number }[]; value: string | null; onChange: (id: string) => void }) {
  const [q, setQ] = React.useState('')
  const needle = q.trim().toLowerCase()
  const list = lessees.filter((l) => !needle || `${l.fullName} ${l.businessName ?? ''}`.toLowerCase().includes(needle)).slice(0, 30)
  return (
    <div>
      <span className="relative block">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or business" aria-label="Search lessees" className="pl-8" />
      </span>
      <RadioGroup value={value ?? ''} onValueChange={onChange} aria-label="Lessee" className="mt-3 max-h-80 gap-0 overflow-y-auto rounded-md border border-border">
        {list.map((l) => (
          <label key={l.id} htmlFor={`lp-${l.id}`} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-surface-muted/60 has-[[data-state=checked]]:bg-primary-soft/60">
            <RadioGroupItem id={`lp-${l.id}`} value={l.id} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{l.fullName}</span>
              <span className="block truncate text-xs text-ink-muted">
                {l.businessName ?? 'No business name'} · {l.stallCodes.length ? `holds ${l.stallCodes.join(', ')}` : 'no active stall'}
              </span>
            </span>
            {l.balance > 0 ? (
              <span className="text-right text-xs">
                <span className="block text-ink-muted">Balance</span>
                <Amount value={l.balance} size="sm" className="text-money-short" />
              </span>
            ) : null}
          </label>
        ))}
        {list.length === 0 ? <p className="px-3 py-6 text-center text-sm text-ink-muted">No lessee matches “{q}”.</p> : null}
      </RadioGroup>
    </div>
  )
}
