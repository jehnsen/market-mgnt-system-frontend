import { lguConfig } from '@/config/lgu'
import { buildStallLayout, markets as marketConfig, sections as sectionConfig } from '@/config/markets'
import {
  addDays,
  addMonthKey,
  addMonths,
  dayOfWeek,
  diffDays,
  endOfMonth,
  formatDate,
  formatMonth,
  manilaAt,
  monthKey,
  nowISO,
  todayISO,
} from '@/lib/dates'
import { applyBps, formatPeso, pesos } from '@/lib/money'
import { renderTemplate, smsUnits } from '@/lib/sms'
import type {
  AccountableFormSeries,
  Assignment,
  AuditEntry,
  AppNotification,
  BillingRun,
  Charge,
  Collection,
  Collector,
  DayClose,
  DemandNotice,
  DemandNoticeLevel,
  Device,
  DeviceEvent,
  FeeKind,
  FeeRate,
  FeeSchedule,
  FormAlert,
  ISODate,
  ISODateTime,
  Lease,
  LegacyMonthly,
  Lessee,
  MonthKey,
  Payment,
  ReconRecord,
  Remittance,
  SectionCategory,
  SmsMessage,
  SmsTemplate,
  Stall,
  StallDocument,
  StallStatusChange,
  StallType,
  User,
} from '@/types'
import type { Db } from './db'
import { reconKey } from './db'
import { BARANGAYS, BUSINESS_SUFFIX, GIVEN_NAMES, MIDDLE_INITIALS, SURNAMES, TRANSIENT_GOODS } from './names'
import { hashString, Rng } from './rng'

const PENALTY_BPS = 200
const V1 = 'fs-v1'
const V2 = 'fs-v2'
const V2_FROM = '2025-01-01'

/* ------------------------------------------------------------------ people */

const USERS: Omit<User, 'lastLoginAt'>[] = [
  { id: 'u-treasurer', name: 'Leonora D. Villaflor', email: 'leonora.villaflor@pontevedra.example.gov.ph', role: 'treasurer', title: 'Municipal Treasurer', status: 'active', mfaEnabled: true },
  { id: 'u-staff1', name: 'Ramon T. Bautista', email: 'ramon.bautista@pontevedra.example.gov.ph', role: 'treasury_staff', title: 'Revenue Collection Clerk III', status: 'active', mfaEnabled: false },
  { id: 'u-staff2', name: 'Gemma P. Arceño', email: 'gemma.arceno@pontevedra.example.gov.ph', role: 'treasury_staff', title: 'Cashier II', status: 'active', mfaEnabled: false },
  { id: 'u-supervisor', name: 'Eduardo S. Navarra', email: 'eduardo.navarra@pontevedra.example.gov.ph', role: 'market_supervisor', title: 'Market Supervisor', status: 'active', mfaEnabled: false },
  { id: 'u-mayor', name: 'Josefina M. Gardoce', email: 'josefina.gardoce@pontevedra.example.gov.ph', role: 'mayor', title: 'Executive Assistant, Office of the Mayor', status: 'active', mfaEnabled: false },
  { id: 'u-sb', name: 'Hon. Ricardo A. Gallo', email: 'ricardo.gallo@pontevedra.example.gov.ph', role: 'sb', title: 'SB Member, Committee on Markets', status: 'active', mfaEnabled: false },
  { id: 'u-admin', name: 'Kevin R. Sumagaysay', email: 'kevin.sumagaysay@pontevedra.example.gov.ph', role: 'admin', title: 'Information Systems Officer', status: 'active', mfaEnabled: true },
  { id: 'u-staff3', name: 'Aileen C. Matias', email: 'aileen.matias@pontevedra.example.gov.ph', role: 'treasury_staff', title: 'Administrative Aide IV', status: 'invited', mfaEnabled: false },
]

const TREASURER = 'Leonora D. Villaflor'
const STAFF = ['Ramon T. Bautista', 'Gemma P. Arceño']
const SUPERVISOR = 'Eduardo S. Navarra'

const COLLECTORS: { id: string; code: string; first: string; last: string; marketId: string; sections: string[] }[] = [
  { id: 'col-01', code: 'C-01', first: 'Rodel', last: 'Abellar', marketId: 'pm', sections: ['pm-meat', 'pm-dry'] },
  { id: 'col-02', code: 'C-02', first: 'Marites', last: 'Fuentes', marketId: 'pm', sections: ['pm-veg'] },
  { id: 'col-03', code: 'C-03', first: 'Arnel', last: 'Bacolod', marketId: 'pm', sections: ['pm-eat', 'pm-oth'] },
  { id: 'col-04', code: 'C-04', first: 'Lorna', last: 'Desales', marketId: 'sm', sections: ['sm-fn'] },
  { id: 'col-05', code: 'C-05', first: 'Jerome', last: 'Ticao', marketId: 'sm', sections: ['sm-fs', 'sm-oth'] },
  { id: 'col-06', code: 'C-06', first: 'Nenita', last: 'Balderas', marketId: 'sm', sections: ['sm-tr'] },
]

const DEVICE_MODELS = ['Samsung Galaxy A15', 'Xiaomi Redmi 13C', 'realme C55', 'Samsung Galaxy A05s', 'vivo Y17s', 'Xiaomi Redmi 12', 'Samsung Galaxy A14', 'realme C53']

/* -------------------------------------------------------------- fee tables */

type RateRow = [market: string, category: SectionCategory, type: StallType | null, kind: FeeKind, pesos: number, label: string | null]

const RATES_V2: RateRow[] = [
  ['pm', 'meat', 'cold', 'monthly_rental', 3500, null],
  ['pm', 'meat', 'corner', 'monthly_rental', 2600, null],
  ['pm', 'meat', 'standard', 'monthly_rental', 2200, null],
  ['pm', 'dry_goods', 'corner', 'monthly_rental', 1900, null],
  ['pm', 'dry_goods', 'standard', 'monthly_rental', 1500, null],
  ['pm', 'vegetables', 'corner', 'monthly_rental', 1400, null],
  ['pm', 'vegetables', 'standard', 'monthly_rental', 1100, null],
  ['pm', 'eateries', 'eatery', 'monthly_rental', 3000, null],
  ['pm', 'others', 'kiosk', 'monthly_rental', 800, null],
  ['sm', 'fish', 'corner', 'monthly_rental', 2200, null],
  ['sm', 'fish', 'standard', 'monthly_rental', 1800, null],
  ['sm', 'others', 'kiosk', 'monthly_rental', 950, null],
  ['pm', 'meat', null, 'daily_fee', 60, null],
  ['pm', 'dry_goods', null, 'daily_fee', 40, null],
  ['pm', 'vegetables', null, 'daily_fee', 30, null],
  ['pm', 'eateries', null, 'daily_fee', 80, null],
  ['pm', 'others', null, 'daily_fee', 20, null],
  ['sm', 'fish', null, 'daily_fee', 50, null],
  ['sm', 'others', null, 'daily_fee', 25, null],
  ['sm', 'transient', null, 'transient_fee', 30, 'Small basket (bukag)'],
  ['sm', 'transient', null, 'transient_fee', 75, 'Per tub (banyera)'],
  ['sm', 'transient', null, 'transient_fee', 150, 'Bulk / tricycle load'],
]

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step)

/* -------------------------------------------------------------------- seed */

export function createSeed(now: Date): Db {
  const rng = new Rng(hashString('marcis:pontevedra:v1'))
  const today = todayISO(now)
  const start = addDays(today, -89)
  const currentMonth = monthKey(today)
  const todayDay = Number(today.slice(8, 10))
  const nowMs = now.getTime()
  const at = (ms: number): ISODateTime => nowISO(new Date(ms))
  const minutesAgo = (m: number) => at(nowMs - m * 60_000)
  const capNow = (iso: ISODateTime): ISODateTime => (new Date(iso).getTime() > nowMs ? minutesAgo(1) : iso)

  const audit: AuditEntry[] = []
  const pushAudit = (e: Omit<AuditEntry, 'id'>) => audit.push({ ...e, id: `aud-${audit.length + 1}` })

  /* ---------------------------------------------------------------- users */
  const users: User[] = USERS.map((u) => ({
    ...u,
    lastLoginAt: u.status === 'invited' ? null : minutesAgo(rng.int(20, 60 * 48)),
  }))

  /* ------------------------------------------------------- markets/stalls */
  const markets = marketConfig.map((m) => ({ ...m, zones: m.zones.map((z) => ({ ...z })) }))
  const sections = sectionConfig.map((s) => ({ ...s }))
  const sectionById = new Map(sections.map((s) => [s.id, s]))
  const stalls: Stall[] = buildStallLayout().map((l): Stall => ({
    ...l,
    status: 'occupied',
    currentLeaseId: null,
    vacantSince: null,
  }))
  const order = rng.shuffle(stalls.map((_, i) => i))
  const vacantIdx = order.slice(0, 15)
  const reservedIdx = order.slice(15, 20)
  const repairIdx = order.slice(20, 25)
  vacantIdx.forEach((i, n) => {
    const s = stalls[i]!
    s.status = 'vacant'
    s.vacantSince = addDays(today, n < 5 ? -rng.int(70, 260) : -rng.int(4, 55))
  })
  reservedIdx.forEach((i) => {
    const s = stalls[i]!
    s.status = 'reserved'
    s.vacantSince = addDays(today, -rng.int(15, 50))
  })
  repairIdx.forEach((i) => {
    const s = stalls[i]!
    s.status = 'under_repair'
    s.vacantSince = addDays(today, -rng.int(10, 45))
  })

  /* --------------------------------------------------------- fee schedule */
  const feeSchedules: FeeSchedule[] = [
    {
      id: V1,
      version: 1,
      name: 'Market Code schedule of fees',
      ordinanceRef: 'Municipal Ordinance No. 2019-07 (Pontevedra Market Code), Sec. 18',
      effectiveFrom: '2019-07-01',
      effectiveTo: '2024-12-31',
      penaltyRateBps: PENALTY_BPS,
      penaltyRule:
        'Rentals are due on or before the last day of each month. Unpaid rentals incur a surcharge of 2% per month on the overdue amount, applied at each monthly billing run.',
      penaltyOrdinanceRef: 'Municipal Ordinance No. 2019-07, Sec. 24',
      createdAt: '2019-06-14T10:00:00+08:00',
      createdByName: 'System migration',
      notes: 'Original schedule under the 2019 Market Code.',
    },
    {
      id: V2,
      version: 2,
      name: 'Revised schedule of market fees',
      ordinanceRef: 'Municipal Ordinance No. 2024-15, Sec. 3 (amending Sec. 18 of MO 2019-07)',
      effectiveFrom: V2_FROM,
      effectiveTo: null,
      penaltyRateBps: PENALTY_BPS,
      penaltyRule:
        'Rentals are due on or before the last day of each month. Unpaid rentals incur a surcharge of 2% per month on the overdue amount, applied at each monthly billing run.',
      penaltyOrdinanceRef: 'Municipal Ordinance No. 2019-07, Sec. 24',
      createdAt: '2024-12-16T09:30:00+08:00',
      createdByName: TREASURER,
      notes: 'Rates revised after the 2024 public consultation with market vendors.',
    },
  ]
  const feeRates: FeeRate[] = []
  RATES_V2.forEach(([market, category, type, kind, amount, label], i) => {
    const section = kind === 'monthly_rental' ? 'a' : kind === 'daily_fee' ? 'b' : 'c'
    feeRates.push({
      id: `fr-v1-${i + 1}`,
      scheduleId: V1,
      marketId: market,
      sectionCategory: category,
      stallType: type,
      kind,
      label,
      amount: pesos(kind === 'monthly_rental' ? roundTo(amount * 0.85, 50) : roundTo(amount * 0.8, 5)),
      ordinanceRef: `MO 2019-07, Sec. 18(${section})`,
      effectiveFrom: '2019-07-01',
      effectiveTo: '2024-12-31',
    })
    feeRates.push({
      id: `fr-v2-${i + 1}`,
      scheduleId: V2,
      marketId: market,
      sectionCategory: category,
      stallType: type,
      kind,
      label,
      amount: pesos(amount),
      ordinanceRef: `MO 2024-15, Sec. 3(${section})`,
      effectiveFrom: V2_FROM,
      effectiveTo: null,
    })
  })
  const scheduleOn = (d: ISODate) => (d >= V2_FROM ? V2 : V1)
  const rateFor = (scheduleId: string, stall: Stall, kind: FeeKind): FeeRate => {
    const cat = sectionById.get(stall.sectionId)!.category
    const candidates = feeRates.filter(
      (r) => r.scheduleId === scheduleId && r.marketId === stall.marketId && r.sectionCategory === cat && r.kind === kind,
    )
    const hit = candidates.find((r) => r.stallType === stall.type) ?? candidates.find((r) => r.stallType === null)
    if (!hit) throw new Error(`No ${kind} rate for ${stall.code}`)
    return hit
  }
  const transientRates = (scheduleId: string) =>
    feeRates.filter((r) => r.scheduleId === scheduleId && r.kind === 'transient_fee')

  /* -------------------------------------------------------------- lessees */
  const usedNames = new Set<string>()
  const makePerson = () => {
    for (;;) {
      const first = rng.pick(GIVEN_NAMES)
      const last = rng.pick(SURNAMES)
      const mi = rng.pick(MIDDLE_INITIALS)
      const full = `${first} ${mi}. ${last}`
      if (usedNames.has(`${first} ${last}`)) continue
      usedNames.add(`${first} ${last}`)
      return { first, last, mi, full }
    }
  }
  for (const c of COLLECTORS) usedNames.add(`${c.first} ${c.last}`)
  const phone = () => `09${rng.int(15, 99)} 555 ${rng.int(1000, 9999)}`

  const lessees: Lessee[] = []
  const newLessee = (category: SectionCategory | null): Lessee => {
    const p = makePerson()
    const suffixes = category ? BUSINESS_SUFFIX[category] : undefined
    const consent = rng.chance(0.86)
    const registeredOn = addDays(today, -rng.int(200, 3200))
    const l: Lessee = {
      id: `les-${String(lessees.length + 1).padStart(3, '0')}`,
      firstName: p.first,
      middleInitial: p.mi,
      lastName: p.last,
      fullName: p.full,
      businessName: suffixes && rng.chance(0.55) ? `${p.last.replace(/ .*/, '')}'s ${rng.pick(suffixes)}` : null,
      contactNumber: phone(),
      email: rng.chance(0.25) ? `${p.first.toLowerCase()}.${p.last.toLowerCase().replace(/[^a-z]/g, '')}@mail.example.com` : null,
      address: `Brgy. ${rng.pick(BARANGAYS)}, Pontevedra, Capiz`,
      smsConsent: consent,
      smsConsentAt: consent ? `${addDays(registeredOn, rng.int(0, 60))}T10:00:00+08:00` : null,
      registeredOn,
      notes: null,
    }
    lessees.push(l)
    return l
  }

  /* --------------------------------------------------------------- leases */
  const leases: Lease[] = []
  const occupied = stalls.filter((s) => s.status === 'occupied')
  const offsets: number[] = []
  for (let i = 0; i < 9; i++) offsets.push(rng.int(2, 30))
  for (let i = 0; i < 12; i++) offsets.push(rng.int(31, 90))
  while (offsets.length < occupied.length) offsets.push(rng.int(91, 700))
  const shuffledOffsets = rng.shuffle(offsets)

  const CONDITIONS = [
    'Lessee shall keep the stall and the adjoining aisle clean at all times.',
    'No subleasing or transfer of the stall without the written approval of the Municipal Treasurer.',
    'Electric consumption of the chiller is billed separately through the sub-meter.',
    'Stall shall be open for business at least six (6) days a week.',
    '',
    '',
  ]

  const makeLease = (stall: Stall, lessee: Lessee, startDate: ISODate, endDate: ISODate, status: Lease['status']): Lease => {
    const sched = scheduleOn(startDate)
    const rate = rateFor(sched, stall, 'monthly_rental')
    const lease: Lease = {
      id: `lea-${String(leases.length + 1).padStart(4, '0')}`,
      leaseNo: '',
      stallId: stall.id,
      lesseeId: lessee.id,
      startDate,
      endDate,
      termMonths: Math.max(1, Math.round(diffDays(startDate, endDate) / 30.4)),
      monthlyRate: rate.amount,
      deposit: rate.amount * 2,
      status,
      feeScheduleVersionId: sched,
      feeRateId: rate.id,
      specialConditions: [rng.pick(CONDITIONS), rng.pick(CONDITIONS)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' '),
      createdAt: `${addDays(startDate, -rng.int(3, 14))}T10:${String(rng.int(10, 59))}:00+08:00`,
      createdByName: SUPERVISOR,
      renewedFromLeaseId: null,
      terminatedOn: null,
      terminationReason: null,
    }
    leases.push(lease)
    return lease
  }

  const activeLessees: Lessee[] = []
  occupied.forEach((stall, i) => {
    const cat = sectionById.get(stall.sectionId)!.category
    const lessee = i < occupied.length - 7 ? newLessee(cat) : rng.pick(activeLessees)
    if (!activeLessees.includes(lessee)) activeLessees.push(lessee)
    const endDate = addDays(today, shuffledOffsets[i]!)
    let term = 12
    for (const t of [12, 24, 36, 60]) {
      term = t
      if (addDays(addMonths(endDate, -t), 1) <= addDays(today, -20)) break
    }
    if (term < 60 && rng.chance(0.3)) term = term === 12 ? 24 : term
    const startDate = addDays(addMonths(endDate, -term), 1)
    const lease = makeLease(stall, lessee, startDate, endDate, 'active')
    stall.currentLeaseId = lease.id
    if (startDate > '2022-06-01' && rng.chance(0.45)) {
      const prevEnd = addDays(startDate, -1)
      const prev = makeLease(stall, lessee, addDays(addMonths(prevEnd, -12), 1), prevEnd, 'expired')
      lease.renewedFromLeaseId = prev.id
    }
  })

  // Former lessees whose stalls are now vacant.
  const vacantStalls = stalls.filter((s) => s.status === 'vacant')
  vacantStalls.forEach((stall, i) => {
    const cat = sectionById.get(stall.sectionId)!.category
    const lessee = i < 6 ? newLessee(cat) : rng.pick(activeLessees)
    const end = addDays(stall.vacantSince!, -1)
    const startDate = addDays(addMonths(end, -12), 1)
    const terminated = i === 1 || i === 3 || i === 8
    const lease = makeLease(stall, lessee, startDate, terminated ? addMonths(end, 7) : end, terminated ? 'terminated' : 'expired')
    if (terminated) {
      lease.terminatedOn = end
      lease.terminationReason =
        i === 8
          ? 'Voluntary surrender of stall; lessee relocated to a private commercial space.'
          : 'Non-payment of rentals for more than three (3) months; final demand notice unheeded.'
    }
  })

  // Lease numbers in chronological order per year.
  const perYear: Record<string, number> = {}
  ;[...leases]
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
    .forEach((l) => {
      const y = l.startDate.slice(0, 4)
      perYear[y] = (perYear[y] ?? 0) + 1
      l.leaseNo = `L-${y}-${String(perYear[y]).padStart(4, '0')}`
    })

  const leaseEnd = (l: Lease) => l.terminatedOn ?? l.endDate
  const leasesByStall = new Map<string, Lease[]>()
  for (const l of leases) {
    const list = leasesByStall.get(l.stallId) ?? []
    list.push(l)
    leasesByStall.set(l.stallId, list)
  }
  const leaseOn = (stallId: string, d: ISODate) =>
    leasesByStall.get(stallId)?.find((l) => l.startDate <= d && leaseEnd(l) >= d) ?? null

  /* ------------------------------------------- charges, payments, arrears */
  const firstMonth = addMonthKey(currentMonth, -11)
  const billingRuns: BillingRun[] = []
  for (let m = firstMonth; m <= currentMonth; m = addMonthKey(m, 1)) {
    billingRuns.push({
      id: `br-${m}`,
      month: m,
      generatedAt: `${m}-01T08:${String(rng.int(5, 40)).padStart(2, '0')}:00+08:00`,
      generatedByName: TREASURER,
      leaseCount: 0,
      rentalTotal: 0,
      penaltyTotal: 0,
    })
  }
  const runByMonth = new Map(billingRuns.map((r) => [r.month, r]))

  const charges: Charge[] = []
  const payments: Payment[] = []
  const addCharge = (lease: Lease, month: MonthKey, kind: Charge['kind'], amount: number, note: string) => {
    const run = runByMonth.get(month)
    charges.push({
      id: `chg-${charges.length + 1}`,
      leaseId: lease.id,
      lesseeId: lease.lesseeId,
      stallId: lease.stallId,
      month,
      kind,
      amount,
      dueDate: endOfMonth(month),
      billingRunId: run?.id ?? null,
      note,
    })
    if (run) {
      if (kind === 'rental') run.rentalTotal += amount
      else run.penaltyTotal += amount
    }
  }
  let windowOr = 1_984_001
  let histOr = 2_105_001
  const fieldPayments = new Map<string, Payment[]>() // `${date}|${stallId}`
  const addPayment = (lease: Lease, date: ISODate, amount: number, kind: Payment['kind']) => {
    const field = date >= start && date <= today && rng.chance(0.82) && leaseOn(lease.stallId, date)?.id === lease.id
    const p: Payment = {
      id: `pay-${payments.length + 1}`,
      leaseId: lease.id,
      lesseeId: lease.lesseeId,
      date,
      amount,
      kind,
      receiptSerial: field ? '' : String(date >= start ? windowOr++ : histOr++).padStart(7, '0'),
      source: field ? 'field_collection' : 'treasury_window',
      collectionId: null,
    }
    payments.push(p)
    if (field) {
      const key = `${date}|${lease.stallId}`
      const list = fieldPayments.get(key) ?? []
      list.push(p)
      fieldPayments.set(key, list)
    }
  }

  // Delinquency profile = number of most recent billed months left unpaid.
  const activeLeases = leases.filter((l) => l.status === 'active')
  const profile: number[] = []
  const pushN = (n: number, k: () => number) => {
    for (let i = 0; i < n; i++) profile.push(k())
  }
  pushN(25, () => 1)
  pushN(15, () => 2)
  pushN(8, () => 3)
  pushN(5, () => 4)
  pushN(7, () => rng.int(5, 9))
  while (profile.length < activeLeases.length) profile.push(0)
  const shuffledProfile = rng.shuffle(profile)
  const unpaidMonthsByLease = new Map<string, MonthKey[]>()

  leases.forEach((lease) => {
    const months: MonthKey[] = []
    const from = monthKey(lease.startDate) > firstMonth ? monthKey(lease.startDate) : firstMonth
    const to = monthKey(leaseEnd(lease)) < currentMonth ? monthKey(leaseEnd(lease)) : currentMonth
    for (let m = from; m <= to; m = addMonthKey(m, 1)) months.push(m)
    if (months.length === 0) return
    for (const m of months) addCharge(lease, m, 'rental', lease.monthlyRate, `Stall rental, ${formatMonth(m)}`)

    let k = 0
    if (lease.status === 'active') k = shuffledProfile[activeLeases.indexOf(lease)] ?? 0
    else if (lease.terminationReason?.startsWith('Non-payment')) k = 4
    if (lease.status === 'active' && todayDay === 1 && k === 0) k = 1
    k = Math.min(k, months.length)
    const unpaid = months.slice(months.length - k)
    unpaidMonthsByLease.set(lease.id, unpaid)

    // Penalties on the unpaid tail, accrued at each later billing run.
    for (let j = 1; j < unpaid.length; j++) {
      const overdue = lease.monthlyRate * j
      addCharge(lease, unpaid[j]!, 'penalty', applyBps(overdue, PENALTY_BPS), `Surcharge 2% on overdue rental of ${formatPeso(overdue)}`)
    }

    const latePayer = k === 0 && lease.status === 'active' && rng.chance(0.14)
    const lateIdx = latePayer ? rng.int(Math.max(0, months.length - 4), months.length - 2) : -1
    months.forEach((m, idx) => {
      if (unpaid.includes(m)) return
      if (idx === lateIdx) {
        const next = addMonthKey(m, 1)
        const payDate = `${next}-${String(rng.int(3, 15)).padStart(2, '0')}`
        if (payDate < today) {
          const penalty = applyBps(lease.monthlyRate, PENALTY_BPS)
          addCharge(lease, next, 'penalty', penalty, `Surcharge 2% on overdue rental of ${formatPeso(lease.monthlyRate)}`)
          addPayment(lease, payDate, lease.monthlyRate, 'rental')
          addPayment(lease, payDate, penalty, 'penalty')
          return
        }
      }
      const lastDay = m === currentMonth ? todayDay : 28
      let payDate = `${m}-${String(rng.int(1, lastDay)).padStart(2, '0')}`
      if (payDate < lease.startDate) payDate = lease.startDate
      if (payDate > leaseEnd(lease)) payDate = leaseEnd(lease)
      if (payDate > today) payDate = today
      addPayment(lease, payDate, lease.monthlyRate, 'rental')
    })
  })
  for (const run of billingRuns) {
    run.leaseCount = new Set(charges.filter((c) => c.billingRunId === run.id).map((c) => c.leaseId)).size
  }

  /* ---------------------------------------------- collectors and devices */
  const devices: Device[] = []
  const deviceEvents: DeviceEvent[] = []
  const collectors: Collector[] = COLLECTORS.map((c, i): Collector => {
    const deviceId = `dev-${String(i + 1).padStart(2, '0')}`
    devices.push({
      id: deviceId,
      collectorId: c.id,
      label: `DEV-${String(i + 1).padStart(2, '0')}`,
      model: DEVICE_MODELS[i]!,
      serialNo: `R${rng.hex(4).toUpperCase()}${rng.int(100000, 999999)}`,
      appVersion: c.id === 'col-05' ? '1.3.9' : '1.4.2',
      lastSyncAt: minutesAgo(5),
      unsyncedCount: 0,
      batteryPct: rng.int(38, 96),
      status: 'active',
      registeredOn: c.id === 'col-02' ? addDays(today, -50) : addDays(today, -rng.int(200, 420)),
      deactivatedAt: null,
      deactivatedReason: null,
    })
    return {
      id: c.id,
      code: c.code,
      firstName: c.first,
      lastName: c.last,
      fullName: `${c.first} ${c.last}`,
      contactNumber: phone(),
      marketId: c.marketId,
      status: 'active',
      deviceId,
      employedSince: addDays(today, -rng.int(500, 3000)),
      suspendedReason: null,
    }
  })
  // Lost phone replaced 50 days ago, and one spare unit.
  devices.push({
    id: 'dev-07',
    collectorId: null,
    label: 'DEV-07',
    model: DEVICE_MODELS[6]!,
    serialNo: `R${rng.hex(4).toUpperCase()}${rng.int(100000, 999999)}`,
    appVersion: '1.3.9',
    lastSyncAt: `${addDays(today, -51)}T09:12:00+08:00`,
    unsyncedCount: 0,
    batteryPct: 0,
    status: 'deactivated',
    registeredOn: addDays(today, -400),
    deactivatedAt: `${addDays(today, -50)}T13:40:00+08:00`,
    deactivatedReason: 'Phone reported lost by collector on the way home; all entries were synced before loss.',
  })
  devices.push({
    id: 'dev-08',
    collectorId: null,
    label: 'DEV-08',
    model: DEVICE_MODELS[7]!,
    serialNo: `R${rng.hex(4).toUpperCase()}${rng.int(100000, 999999)}`,
    appVersion: '1.4.2',
    lastSyncAt: `${addDays(today, -9)}T16:02:00+08:00`,
    unsyncedCount: 0,
    batteryPct: 100,
    status: 'active',
    registeredOn: addDays(today, -60),
    deactivatedAt: null,
    deactivatedReason: null,
  })
  for (const d of devices) {
    deviceEvents.push({ id: `dve-${deviceEvents.length + 1}`, deviceId: d.id, collectorId: d.collectorId, at: `${d.registeredOn}T09:00:00+08:00`, event: 'registered', note: `${d.model} enrolled in MARCIS Collector app` })
    if (d.collectorId) deviceEvents.push({ id: `dve-${deviceEvents.length + 1}`, deviceId: d.id, collectorId: d.collectorId, at: `${d.registeredOn}T09:20:00+08:00`, event: 'assigned', note: 'Assigned to collector' })
    if (d.appVersion === '1.4.2' && d.collectorId) deviceEvents.push({ id: `dve-${deviceEvents.length + 1}`, deviceId: d.id, collectorId: d.collectorId, at: `${addDays(today, -24)}T06:10:00+08:00`, event: 'app_updated', note: 'App updated 1.3.9 → 1.4.2' })
  }
  deviceEvents.push({ id: `dve-${deviceEvents.length + 1}`, deviceId: 'dev-07', collectorId: 'col-02', at: `${addDays(today, -400)}T09:20:00+08:00`, event: 'assigned', note: 'Assigned to collector' })
  deviceEvents.push({ id: `dve-${deviceEvents.length + 1}`, deviceId: 'dev-07', collectorId: 'col-02', at: `${addDays(today, -50)}T13:40:00+08:00`, event: 'deactivated', note: 'Deactivated: phone reported lost' })

  const assignments: Assignment[] = []
  for (const c of COLLECTORS) {
    for (const sid of c.sections) {
      assignments.push({ id: `asg-${assignments.length + 1}`, collectorId: c.id, marketId: c.marketId, sectionId: sid, effectiveFrom: addDays(today, -400), effectiveTo: null })
    }
  }
  const deviceFor = (collectorId: string, d: ISODate) => {
    if (collectorId === 'col-02' && d < addDays(today, -50)) return devices.find((x) => x.id === 'dev-07')!
    return devices.find((x) => x.collectorId === collectorId)!
  }

  /* -------------------------------------------- accountable form series */
  const formSeries: AccountableFormSeries[] = []
  const formAlerts: FormAlert[] = []
  const nextStart: Record<string, number> = { ct: 412_001, af51: 2_208_451 }
  const SERIES_SIZE: Record<string, number> = { ct: 500, af51: 50 }
  const issueSeries = (form: string, collectorId: string | null, date: ISODate | null): AccountableFormSeries => {
    const s: AccountableFormSeries = {
      id: `afs-${String(formSeries.length + 1).padStart(3, '0')}`,
      formType: form,
      start: nextStart[form]!,
      end: nextStart[form]! + SERIES_SIZE[form]! - 1,
      issuedTo: collectorId,
      issuedOn: date,
      issuedByName: collectorId ? rng.pick(STAFF) : null,
      lastUsed: null,
      usedCount: 0,
      status: collectorId ? 'issued' : 'in_stock',
      returnedOn: null,
      missingReason: null,
      missingSerials: [],
    }
    nextStart[form] = s.end + 1
    formSeries.push(s)
    return s
  }
  const held = new Map<string, { series: AccountableFormSeries; next: number }>()
  const takeSerial = (collectorId: string, form: string, date: ISODate): number => {
    const key = `${collectorId}|${form}`
    let h = held.get(key)
    if (!h || h.next > h.series.end) {
      if (h) h.series.status = 'exhausted'
      const series = issueSeries(form, collectorId, h ? date : addDays(start, -1))
      h = { series, next: series.start }
      held.set(key, h)
    }
    const n = h.next
    h.next += 1
    h.series.lastUsed = n
    h.series.usedCount += 1
    return n
  }
  const skipSerial = (collectorId: string, form: string) => {
    const h = held.get(`${collectorId}|${form}`)
    if (h) h.next += 1
  }
  const pad = (n: number) => String(n).padStart(7, '0')

  /* ---------------------------------------------------------- collections */
  const collections: Collection[] = []
  const remittances: Remittance[] = []
  const recon = new Map<string, ReconRecord>()
  const sectionStalls = new Map<string, Stall[]>()
  for (const s of stalls) {
    const list = sectionStalls.get(s.sectionId) ?? []
    list.push(s)
    sectionStalls.set(s.sectionId, list)
  }
  const transientVendors = Array.from({ length: 36 }, () => makePerson().full)

  // Planned anomalies, keyed by `${collectorId}|${dayOffset}`.
  const ANOMALY_DELTA: Record<string, number> = {
    'col-03|-30': -15000,
    'col-05|-21': -32000,
    'col-06|-17': 4000,
    'col-01|-15': -7500,
    'col-05|-3': -10000,
    'col-02|-1': -20000,
  }
  const FLAG_REASON: Record<string, string> = {
    'col-03|-30': 'Collector reports a torn ₱100 bill rejected at deposit and ₱50 change error. Salary deduction agreed with the Treasurer.',
    'col-05|-21': 'Shortage traced to a ₱320 cash ticket bundle not turned over; collector to settle within 5 days.',
    'col-06|-17': 'Transient vendor overpaid ₱40; amount held in trust for refund on next market day.',
    'col-01|-15': 'Change-making error at Meat section. Collector settled the ₱75 on the following day.',
    'col-05|-3': 'Collector reports ₱100 short; investigating whether a ticket was double-encoded.',
  }
  const offsetOf = (d: ISODate) => diffDays(today, d)

  const c5Stale = nowMs - 160 * 60_000
  let rcdSeq = 1
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const off = offsetOf(d)
    for (const col of COLLECTORS) {
      type Draft = Omit<Collection, 'id' | 'receiptSerial' | 'recordedAt' | 'syncedAt' | 'synced' | 'deviceId' | 'collectorId' | 'businessDate' | 'status'> & { trueAmount: number; payment?: Payment }
      const drafts: Draft[] = []
      const base = {
        correctsCollectionId: null,
        correctedByCollectionId: null,
        correctionReason: null,
        correctionStatus: null,
        correctionRequestedBy: null,
        correctionReviewedBy: null,
        correctionReviewedAt: null,
        correctionReviewNote: null,
        remarks: null,
      }
      for (const sid of col.sections) {
        const section = sectionById.get(sid)!
        if (section.category === 'transient') {
          const dow = dayOfWeek(d)
          const n = rng.int(8, 16) + (dow === 5 || dow === 6 ? 4 : 0)
          const tiers = transientRates(scheduleOn(d))
          for (let i = 0; i < n; i++) {
            const tierRoll = rng.next()
            const tier = tiers[tierRoll < 0.45 ? 0 : tierRoll < 0.88 ? 1 : 2]!
            const qty = tier.label?.startsWith('Per tub') ? rng.int(1, 2) : 1
            drafts.push({
              ...base,
              marketId: col.marketId,
              sectionId: sid,
              stallId: null,
              leaseId: null,
              lesseeId: null,
              transientVendorName: rng.pick(transientVendors),
              transientGoods: `${rng.pick(TRANSIENT_GOODS)} · ${qty > 1 ? `${qty} × ` : ''}${tier.label}`,
              type: 'transient_fee',
              formType: 'ct',
              amount: tier.amount * qty,
              trueAmount: tier.amount * qty,
            })
          }
          continue
        }
        for (const stall of sectionStalls.get(sid) ?? []) {
          const lease = leaseOn(stall.id, d)
          if (!lease) continue
          for (const p of fieldPayments.get(`${d}|${stall.id}`) ?? []) {
            drafts.push({
              ...base,
              marketId: col.marketId,
              sectionId: sid,
              stallId: stall.id,
              leaseId: lease.id,
              lesseeId: lease.lesseeId,
              transientVendorName: null,
              transientGoods: null,
              type: p.kind === 'rental' ? 'monthly_rental' : 'penalty',
              formType: 'af51',
              amount: p.amount,
              trueAmount: p.amount,
              payment: p,
            })
          }
          if (rng.chance(0.94)) {
            const rate = rateFor(scheduleOn(d), stall, 'daily_fee')
            drafts.push({
              ...base,
              marketId: col.marketId,
              sectionId: sid,
              stallId: stall.id,
              leaseId: lease.id,
              lesseeId: lease.lesseeId,
              transientVendorName: null,
              transientGoods: null,
              type: 'daily_fee',
              formType: 'ct',
              amount: rate.amount,
              trueAmount: rate.amount,
            })
          }
        }
        if (sid === 'sm-oth' && rng.chance(0.3)) {
          const amt = pesos(rng.pick([20, 30, 50]))
          drafts.push({
            ...base,
            marketId: col.marketId,
            sectionId: sid,
            stallId: null,
            leaseId: null,
            lesseeId: null,
            transientVendorName: makePersonName(rng, transientVendors),
            transientGoods: null,
            type: 'other',
            formType: 'ct',
            amount: amt,
            trueAmount: amt,
            remarks: 'Use of the market weighing scale',
          })
        }
      }
      if (drafts.length === 0) continue

      // Route timing.
      const openMin = col.marketId === 'sm' ? 4 * 60 + 30 : 5 * 60 + 30
      const step = Math.min(6, Math.max(1.4, 330 / drafts.length))
      const device = deviceFor(col.id, d)
      const items: Collection[] = []
      const anomalyKey = `${col.id}|${off}`
      let ctIndex = 0
      drafts.forEach((draft, i) => {
        const minute = Math.floor(openMin + i * step + rng.next())
        let recordedAt = manilaAt(d, Math.floor(minute / 60), minute % 60, rng.int(0, 59))
        if (d === today && new Date(recordedAt).getTime() > nowMs - 60_000) {
          if (draft.payment) recordedAt = minutesAgo(2)
          else return
        }
        // Anomalies on serials.
        let serialNum: number
        if (draft.formType === 'ct') {
          ctIndex++
          if (anomalyKey === 'col-04|-1' && ctIndex === 15) {
            const prev = [...items].reverse().find((c) => c.formType === 'ct')
            serialNum = prev ? Number(prev.receiptSerial) : takeSerial(col.id, 'ct', d)
            formAlerts.push({ id: `fal-${formAlerts.length + 1}`, kind: 'duplicate', collectorId: col.id, collectorName: '', formType: 'ct', serial: pad(serialNum), date: d, note: 'Same cash ticket serial recorded for two different stalls.' })
          } else {
            serialNum = takeSerial(col.id, 'ct', d)
          }
          if (anomalyKey === 'col-03|-12' && ctIndex === 10) {
            skipSerial(col.id, 'ct')
            formAlerts.push({ id: `fal-${formAlerts.length + 1}`, kind: 'gap', collectorId: col.id, collectorName: '', formType: 'ct', serial: pad(serialNum + 1), date: d, note: 'Serial skipped; ticket not accounted for in the day’s collections.' })
          }
        } else {
          serialNum = takeSerial(col.id, 'af51', d)
        }
        let amount = draft.amount
        if (anomalyKey === 'col-02|-8' && draft.type === 'daily_fee' && ctIndex === 7) amount = draft.trueAmount * 10
        if (anomalyKey === 'col-03|-1' && draft.type === 'daily_fee' && ctIndex === 4) amount = draft.trueAmount + 10000
        const { trueAmount: _t, payment, ...rest } = draft
        const c: Collection = {
          ...rest,
          id: `${device.label}-${d.replace(/-/g, '')}-${String(items.length + 1).padStart(3, '0')}`,
          collectorId: col.id,
          deviceId: device.id,
          businessDate: d,
          amount,
          receiptSerial: pad(serialNum),
          recordedAt,
          syncedAt: null,
          synced: true,
          status: 'synced',
        }
        if (amount !== draft.trueAmount) c.remarks = `__true:${draft.trueAmount}`
        if (payment) {
          payment.receiptSerial = c.receiptSerial
          payment.collectionId = c.id
        }
        items.push(c)
      })

      // Out-of-order use: swap two consecutive cash tickets.
      if (anomalyKey === 'col-01|-20') {
        const cts = items.filter((c) => c.formType === 'ct')
        const a = cts[4]
        const b = cts[5]
        if (a && b) {
          const tmp = a.receiptSerial
          a.receiptSerial = b.receiptSerial
          b.receiptSerial = tmp
          formAlerts.push({ id: `fal-${formAlerts.length + 1}`, kind: 'out_of_order', collectorId: col.id, collectorName: '', formType: 'ct', serial: a.receiptSerial, date: d, note: `Ticket ${a.receiptSerial} issued before ${b.receiptSerial}.` })
        }
      }

      // Sync times.
      for (const c of items) {
        const recMs = new Date(c.recordedAt).getTime()
        const syncMs = recMs + rng.int(1, 25) * 60_000
        if (d === today && col.id === 'col-05' && recMs > c5Stale) {
          c.synced = false
          c.status = 'pending_sync'
          continue
        }
        c.syncedAt = at(Math.min(syncMs, nowMs - 30_000))
      }
      if (d === today && col.id === 'col-05') {
        const pending = items.filter((c) => !c.synced)
        if (pending.length < 6) {
          // Make sure the last few entries are still on the phone.
          const tail = items.slice(-6)
          tail.forEach((c, i) => {
            c.synced = false
            c.status = 'pending_sync'
            c.syncedAt = null
            c.recordedAt = at(c5Stale + ((nowMs - c5Stale) * (i + 1)) / 8)
          })
        }
      }
      collections.push(...items)

      // Corrections.
      for (const c of items) {
        if (!c.remarks?.startsWith('__true:')) continue
        const trueAmount = Number(c.remarks.slice(7))
        c.remarks = null
        const approved = anomalyKey === 'col-02|-8'
        const reqAt = approved ? manilaAt(addDays(d, 1), 9, 15) : capNow(manilaAt(today, 8, 10))
        const corr: Collection = {
          ...c,
          id: `${c.id}-C1`,
          amount: trueAmount - c.amount,
          recordedAt: reqAt,
          syncedAt: reqAt,
          synced: true,
          status: approved ? 'corrected' : 'synced',
          correctsCollectionId: c.id,
          correctionReason: `Amount encoded as ${formatPeso(c.amount)}; cash ticket and collector's tally show ${formatPeso(trueAmount)}.`,
          correctionStatus: approved ? 'approved' : 'pending',
          correctionRequestedBy: SUPERVISOR,
          correctionReviewedBy: approved ? TREASURER : null,
          correctionReviewedAt: approved ? manilaAt(addDays(d, 1), 14, 5) : null,
          correctionReviewNote: approved ? 'Verified against ticket stub. Approved.' : null,
          remarks: null,
        }
        c.correctedByCollectionId = corr.id
        if (approved) c.status = 'corrected'
        collections.push(corr)
      }

      // Remittance and reconciliation state.
      const trueCash = items.reduce((s, c) => s + c.amount, 0) + collections.filter((x) => x.correctsCollectionId && items.some((i) => i.id === x.correctsCollectionId)).reduce((s, x) => s + x.amount, 0)
      const delta = ANOMALY_DELTA[anomalyKey] ?? 0
      if (off < 0) {
        const staff = rng.pick(STAFF)
        remittances.push({
          id: `rem-${remittances.length + 1}`,
          collectorId: col.id,
          businessDate: d,
          amount: trueCash + delta,
          reference: `RCD-${d.replace(/-/g, '')}-${col.code.replace('-', '')}-${String(rcdSeq++).padStart(4, '0')}`,
          receivedByName: staff,
          receivedAt: manilaAt(d, 15, rng.int(0, 50)),
          notes: '',
        })
      }
      let status: ReconRecord['status'] = 'open'
      let before: ReconRecord['statusBeforeClose'] = null
      const flagged = delta < 0 ? 'shortage' : delta > 0 ? 'overage' : 'balanced'
      if (off <= -4) {
        status = 'closed'
        before = flagged
      } else if (off === -3) {
        status = flagged
      } else if (off === -2 && ['col-01', 'col-02', 'col-03'].includes(col.id)) {
        status = 'balanced'
      }
      recon.set(reconKey(col.id, d), {
        collectorId: col.id,
        date: d,
        status,
        statusBeforeClose: before,
        flagReason: FLAG_REASON[anomalyKey] ?? null,
        markedByName: status === 'open' ? null : rng.pick(STAFF),
        markedAt: status === 'open' ? null : manilaAt(d, 16, rng.int(10, 55)),
        notes: '',
      })
    }
  }

  /* ------------------------------------------- legacy monthly history */
  const SEASON = [1.02, 0.98, 1.0, 1.04, 1.06, 0.97, 0.92, 0.9, 0.95, 1.0, 1.03, 1.15]
  const fullDays = diffDays(start, today)
  const dailyAvg = new Map<string, number>()
  for (const c of collections) {
    if (c.businessDate >= today || (c.correctsCollectionId && c.correctionStatus !== 'approved')) continue
    const key = `${c.sectionId}|${c.type}`
    dailyAvg.set(key, (dailyAvg.get(key) ?? 0) + c.amount)
  }
  const legacyMonthly: LegacyMonthly[] = []
  for (let m = addMonthKey(monthKey(start), -24); m <= monthKey(start); m = addMonthKey(m, 1)) {
    const days = m === monthKey(start) ? Number(start.slice(8, 10)) - 1 : Number(endOfMonth(m).slice(8, 10))
    if (days <= 0) continue
    const season = SEASON[Number(m.slice(5, 7)) - 1] ?? 1
    const growth = m < addMonthKey(currentMonth, -12) ? 0.93 : 1
    const oldRates = `${m}-01` < V2_FROM ? 0.86 : 1
    for (const [key, total] of dailyAvg) {
      const [sectionId, type] = key.split('|') as [string, Collection['type']]
      const perDay = total / fullDays
      const noise = 0.96 + rng.next() * 0.08
      legacyMonthly.push({
        month: m,
        marketId: sectionById.get(sectionId)!.marketId,
        sectionId,
        type,
        amount: Math.round(perDay * days * season * growth * oldRates * noise),
      })
    }
  }

  // Device sync state.
  for (const dev of devices) {
    if (!dev.collectorId || dev.status !== 'active') continue
    const mine = collections.filter((c) => c.deviceId === dev.id && c.businessDate === today)
    if (dev.collectorId === 'col-05') {
      dev.lastSyncAt = at(c5Stale)
      dev.unsyncedCount = mine.filter((c) => !c.synced).length
      dev.batteryPct = 23
    } else {
      const last = mine.reduce((m, c) => Math.max(m, new Date(c.recordedAt).getTime()), 0)
      dev.lastSyncAt = at(Math.min(nowMs - 30_000, Math.max(last + 60_000, nowMs - rng.int(3, 25) * 60_000)))
    }
  }

  // Series still in stock, one returned and one reported missing.
  for (let i = 0; i < 4; i++) issueSeries('ct', null, null)
  for (let i = 0; i < 6; i++) issueSeries('af51', null, null)
  const returned = issueSeries('af51', 'col-03', addDays(today, -70))
  returned.status = 'returned'
  returned.returnedOn = addDays(today, -40)
  const missing = issueSeries('af51', 'col-02', addDays(today, -52))
  missing.status = 'missing'
  missing.missingReason = 'Booklet was in the bag of the phone reported lost; police blotter attached. Serials declared cancelled.'
  missing.missingSerials = Array.from({ length: 50 }, (_, i) => missing.start + i)
  formAlerts.push({ id: `fal-${formAlerts.length + 1}`, kind: 'missing', collectorId: 'col-02', collectorName: '', formType: 'af51', serial: `${pad(missing.start)}–${pad(missing.end)}`, date: addDays(today, -50), note: 'Whole booklet reported missing.' })
  for (const a of formAlerts) a.collectorName = collectors.find((c) => c.id === a.collectorId)!.fullName

  /* ------------------------------------------------------------ day close */
  const dayCloses = new Map<ISODate, DayClose>()
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const off = offsetOf(d)
    const closed = off <= -4
    dayCloses.set(d, {
      date: d,
      closed,
      closedByName: closed ? TREASURER : null,
      closedAt: closed ? manilaAt(addDays(d, 1), 10, rng.int(0, 40)) : null,
      reopenings: [],
    })
  }
  const reopened = dayCloses.get(addDays(today, -25))
  if (reopened) {
    reopened.reopenings.push({ at: manilaAt(addDays(today, -23), 9, 5), byName: TREASURER, reason: 'Remittance reference corrected after validation by the depository bank.' })
    reopened.closedAt = manilaAt(addDays(today, -23), 11, 20)
  }

  /* ------------------------------------------------------ demand notices */
  const notices: DemandNotice[] = []
  for (const lease of leases) {
    const unpaid = unpaidMonthsByLease.get(lease.id) ?? []
    if (unpaid.length < 3) continue
    const firstDue = endOfMonth(unpaid[0]!)
    const levels: [DemandNoticeLevel, number][] = [
      ['first', 35],
      ['second', 65],
      ['final', 95],
    ]
    for (const [level, days] of levels) {
      const issuedOn = addDays(firstDue, days)
      if (issuedOn >= today) break
      if (lease.terminatedOn && issuedOn > lease.terminatedOn) break
      const due = charges.filter((c) => c.leaseId === lease.id && unpaid.includes(c.month) && c.dueDate < issuedOn)
      notices.push({
        id: '',
        noticeNo: '',
        lesseeId: lease.lesseeId,
        leaseId: lease.id,
        stallId: lease.stallId,
        level,
        amountDue: due.reduce((s, c) => s + c.amount, 0),
        issuedOn,
        issuedByName: TREASURER,
        dueBy: addDays(issuedOn, 15),
        response: level === 'final' ? 'none' : rng.pick(['none', 'promised', 'none', 'disputed'] as const),
        responseDate: null,
        responseNote: null,
      })
    }
  }
  notices.sort((a, b) => (a.issuedOn < b.issuedOn ? -1 : 1))
  const noticePerYear: Record<string, number> = {}
  notices.forEach((n, i) => {
    const y = n.issuedOn.slice(0, 4)
    noticePerYear[y] = (noticePerYear[y] ?? 0) + 1
    n.id = `dn-${i + 1}`
    n.noticeNo = `DN-${y}-${String(noticePerYear[y]).padStart(4, '0')}`
    if (n.response === 'promised') {
      n.responseDate = addDays(n.issuedOn, rng.int(2, 9))
      n.responseNote = 'Lessee visited the Market Office and committed to a payment schedule.'
    } else if (n.response === 'disputed') {
      n.responseDate = addDays(n.issuedOn, rng.int(2, 9))
      n.responseNote = 'Lessee disputes the surcharge computation; referred to the Treasurer.'
    }
  })

  /* ------------------------------------------------------------------ SMS */
  const smsTemplates: SmsTemplate[] = [
    { id: 'tpl-billing', name: 'Monthly rental reminder', purpose: 'billing', body: 'MTO Pontevedra: Good day {{name}}. Your {{month}} rental for stall {{stall}} is {{amount}}, due on {{due_date}}. Salamat!' },
    { id: 'tpl-overdue', name: 'Overdue balance reminder', purpose: 'overdue', body: 'MTO Pontevedra: {{name}}, stall {{stall}} has an unpaid balance of {{balance}} as of {{as_of}}. Please settle with your collector or at the Market Office. Salamat!' },
    { id: 'tpl-expiring', name: 'Lease expiring', purpose: 'expiring', body: 'MTO Pontevedra: {{name}}, your lease for stall {{stall}} ends on {{lease_end}}. Please visit the Market Office to renew. Salamat!' },
    { id: 'tpl-advisory', name: 'Market advisory', purpose: 'advisory', body: 'MTO Pontevedra: Paalala sa {{market}} vendors: general cleaning on Monday, 5:00–9:00 AM. Please clear aisles the night before. Salamat!' },
  ]
  const smsMessages: SmsMessage[] = []
  const lesseeById = new Map(lessees.map((l) => [l.id, l]))
  const stallById = new Map(stalls.map((s) => [s.id, s]))
  const FAIL_REASONS = ['Number unreachable', 'Invalid mobile number', 'Carrier rejected message']
  let batch = 0
  const send = (tplId: string, lesseeId: string, vars: Record<string, string>, sentAt: ISODateTime, status?: SmsMessage['status']) => {
    const tpl = smsTemplates.find((t) => t.id === tplId)!
    const lessee = lesseeById.get(lesseeId)!
    const body = renderTemplate(tpl.body, { name: lessee.fullName, ...vars })
    const failed = status === 'failed' || (status === undefined && rng.chance(0.025))
    const st = status ?? (failed ? 'failed' : 'sent')
    smsMessages.push({
      id: `sms-${smsMessages.length + 1}`,
      batchId: `b-${batch}`,
      lesseeId,
      recipientName: lessee.fullName,
      phone: lessee.contactNumber,
      templateId: tpl.id,
      templateName: tpl.name,
      body,
      status: st,
      createdAt: sentAt,
      sentAt: st === 'queued' ? null : sentAt,
      scheduledFor: st === 'queued' ? sentAt : null,
      costUnits: st === 'failed' ? 0 : smsUnits(body),
      failureReason: st === 'failed' ? rng.pick(FAIL_REASONS) : null,
    })
  }
  const yearStart = `${today.slice(0, 4)}-01`
  for (let m = yearStart; m <= currentMonth; m = addMonthKey(m, 1)) {
    const sendDay = `${m}-02`
    if (sendDay >= today) continue
    batch++
    for (const lease of leases) {
      if (!(lease.startDate <= sendDay && leaseEnd(lease) >= sendDay)) continue
      const lessee = lesseeById.get(lease.lesseeId)!
      if (!lessee.smsConsent) continue
      send('tpl-billing', lessee.id, { month: formatMonth(m), stall: stallById.get(lease.stallId)!.code, amount: formatPeso(lease.monthlyRate), due_date: formatDate(endOfMonth(m)) }, manilaAt(sendDay, 9, rng.int(0, 20)))
    }
    const overdueDay = `${m}-08`
    if (overdueDay >= today || m < addMonthKey(currentMonth, -2)) continue
    batch++
    for (const lease of activeLeases) {
      const unpaid = unpaidMonthsByLease.get(lease.id) ?? []
      if (unpaid.length < 2 || unpaid[0]! >= m) continue
      const lessee = lesseeById.get(lease.lesseeId)!
      if (!lessee.smsConsent) continue
      const bal = charges.filter((c) => c.leaseId === lease.id && unpaid.includes(c.month) && c.month < m).reduce((s, c) => s + c.amount, 0)
      send('tpl-overdue', lessee.id, { stall: stallById.get(lease.stallId)!.code, balance: formatPeso(bal), as_of: formatDate(overdueDay) }, manilaAt(overdueDay, 10, rng.int(0, 15)), m === currentMonth && rng.chance(0.15) ? 'failed' : undefined)
    }
  }
  batch++
  const advDay = addDays(today, -40)
  for (const lessee of lessees.filter((l) => l.smsConsent).slice(0, 60)) {
    send('tpl-advisory', lessee.id, { market: 'Seafood Market' }, manilaAt(advDay, 14, 0))
  }
  batch++
  const expDay = addDays(today, -6)
  for (const lease of activeLeases.filter((l) => diffDays(expDay, l.endDate) <= 30)) {
    const lessee = lesseeById.get(lease.lesseeId)!
    if (!lessee.smsConsent) continue
    send('tpl-expiring', lessee.id, { stall: stallById.get(lease.stallId)!.code, lease_end: formatDate(lease.endDate) }, manilaAt(expDay, 9, 30))
  }
  batch++
  const tomorrow8 = manilaAt(addDays(today, 1), 8, 0)
  for (const lease of activeLeases.filter((l) => diffDays(today, l.endDate) <= 30).slice(0, 5)) {
    const lessee = lesseeById.get(lease.lesseeId)!
    if (!lessee.smsConsent) continue
    send('tpl-expiring', lessee.id, { stall: stallById.get(lease.stallId)!.code, lease_end: formatDate(lease.endDate) }, tomorrow8, 'queued')
  }
  smsMessages.reverse()

  /* ----------------------------------------------- history and documents */
  const stallHistory: StallStatusChange[] = []
  const documents: StallDocument[] = []
  for (const s of stalls) {
    const ls = (leasesByStall.get(s.id) ?? []).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
    const first = ls[0]
    if (first) stallHistory.push({ id: `ssh-${stallHistory.length + 1}`, stallId: s.id, from: 'vacant', to: 'occupied', at: `${first.startDate}T08:00:00+08:00`, byName: SUPERVISOR, note: `Lease ${first.leaseNo} took effect` })
    if (s.status !== 'occupied' && s.vacantSince) {
      const note =
        s.status === 'vacant'
          ? 'Lease ended; stall turned over to the Market Office'
          : s.status === 'reserved'
            ? 'Reserved for an approved applicant pending lease signing'
            : rng.pick(['Roof leak and gutter repair', 'Drainage rehabilitation', 'Counter tiles and sink replacement'])
      stallHistory.push({ id: `ssh-${stallHistory.length + 1}`, stallId: s.id, from: first ? 'occupied' : 'vacant', to: s.status, at: `${s.vacantSince}T09:00:00+08:00`, byName: SUPERVISOR, note })
    }
  }
  for (const l of leases) {
    documents.push({ id: `doc-${documents.length + 1}`, stallId: l.stallId, lesseeId: l.lesseeId, name: `Lease contract ${l.leaseNo}.pdf`, kind: 'lease_contract', uploadedAt: l.createdAt, sizeKb: rng.int(180, 640) })
  }
  for (const l of lessees) {
    documents.push({ id: `doc-${documents.length + 1}`, stallId: null, lesseeId: l.id, name: 'Valid ID (scanned).pdf', kind: 'id', uploadedAt: `${l.registeredOn}T10:30:00+08:00`, sizeKb: rng.int(90, 300) })
    if (rng.chance(0.7)) documents.push({ id: `doc-${documents.length + 1}`, stallId: null, lesseeId: l.id, name: `Mayor's permit ${today.slice(0, 4)}.pdf`, kind: 'permit', uploadedAt: `${today.slice(0, 4)}-01-${String(rng.int(10, 28))}T11:00:00+08:00`, sizeKb: rng.int(120, 420) })
  }
  for (const s of stalls.filter((x) => x.status === 'under_repair')) {
    documents.push({ id: `doc-${documents.length + 1}`, stallId: s.id, lesseeId: null, name: 'Repair inspection photo.jpg', kind: 'photo', uploadedAt: `${s.vacantSince}T10:00:00+08:00`, sizeKb: rng.int(800, 2400) })
  }

  /* --------------------------------------------------------------- audit */
  for (let d = start; d <= today; d = addDays(d, 1)) {
    for (const r of remittances.filter((x) => x.businessDate === d)) {
      pushAudit({ at: r.receivedAt, actorName: r.receivedByName, actorRole: 'treasury_staff', action: 'remittance.recorded', entity: 'Remittance', entityId: r.reference, summary: `Recorded remittance of ${formatPeso(r.amount)} from ${collectors.find((c) => c.id === r.collectorId)!.fullName}`, before: null, after: { amount: formatPeso(r.amount), reference: r.reference } })
    }
    const dc = dayCloses.get(d)
    if (dc?.closed && dc.closedAt) {
      pushAudit({ at: dc.closedAt, actorName: TREASURER, actorRole: 'treasurer', action: 'day.closed', entity: 'Collection day', entityId: d, summary: `Closed collection day ${formatDate(d)}`, before: { status: 'open' }, after: { status: 'closed' } })
    }
  }
  for (const c of collections.filter((x) => x.correctsCollectionId)) {
    pushAudit({ at: c.recordedAt, actorName: SUPERVISOR, actorRole: 'market_supervisor', action: 'collection.correction_requested', entity: 'Collection', entityId: c.correctsCollectionId!, summary: `Requested correction of ${formatPeso(c.amount, { sign: 'always' })}`, before: null, after: { reason: c.correctionReason } })
    if (c.correctionStatus === 'approved' && c.correctionReviewedAt) {
      pushAudit({ at: c.correctionReviewedAt, actorName: TREASURER, actorRole: 'treasurer', action: 'collection.correction_approved', entity: 'Collection', entityId: c.correctsCollectionId!, summary: 'Approved correction', before: { status: 'pending' }, after: { status: 'approved' } })
    }
  }
  for (const s of formSeries.filter((x) => x.issuedOn && x.issuedTo)) {
    pushAudit({ at: `${s.issuedOn}T07:30:00+08:00`, actorName: s.issuedByName ?? STAFF[0]!, actorRole: 'treasury_staff', action: 'forms.issued', entity: 'Accountable form series', entityId: s.id, summary: `Issued ${s.formType === 'ct' ? 'Cash Ticket' : 'OR'} ${pad(s.start)}–${pad(s.end)} to ${collectors.find((c) => c.id === s.issuedTo)!.fullName}`, before: null, after: { start: s.start, end: s.end } })
  }
  for (const l of leases.filter((x) => x.createdAt >= `${start}T00:00`)) {
    pushAudit({ at: l.createdAt, actorName: SUPERVISOR, actorRole: 'market_supervisor', action: 'lease.created', entity: 'Lease', entityId: l.leaseNo, summary: `Created lease ${l.leaseNo} for stall ${stallById.get(l.stallId)!.code}`, before: null, after: { monthlyRate: formatPeso(l.monthlyRate) } })
  }
  for (const r of billingRuns.filter((x) => x.month >= monthKey(start))) {
    pushAudit({ at: r.generatedAt, actorName: TREASURER, actorRole: 'treasurer', action: 'billing.generated', entity: 'Billing run', entityId: r.month, summary: `Generated billing for ${formatMonth(r.month)} (${r.leaseCount} leases)`, before: null, after: { rental: formatPeso(r.rentalTotal), penalty: formatPeso(r.penaltyTotal) } })
  }
  pushAudit({ at: `${addDays(today, -50)}T13:40:00+08:00`, actorName: SUPERVISOR, actorRole: 'market_supervisor', action: 'device.deactivated', entity: 'Device', entityId: 'DEV-07', summary: 'Deactivated DEV-07 (reported lost)', before: { status: 'active' }, after: { status: 'deactivated' } })
  pushAudit({ at: `${addDays(today, -12)}T10:02:00+08:00`, actorName: 'Kevin R. Sumagaysay', actorRole: 'admin', action: 'user.invited', entity: 'User', entityId: 'u-staff3', summary: 'Invited Aileen C. Matias as Treasury Staff', before: null, after: { role: 'treasury_staff' } })
  pushAudit({ at: minutesAgo(35), actorName: TREASURER, actorRole: 'treasurer', action: 'auth.login', entity: 'Session', entityId: 'u-treasurer', summary: 'Signed in (2-step verification passed)', before: null, after: null })
  audit.sort((a, b) => (a.at < b.at ? 1 : -1))

  /* ------------------------------------------------------- notifications */
  const n = (kind: AppNotification['kind'], title: string, body: string, ago: number, href: string, read = false): AppNotification => ({ id: `ntf-${kind}-${ago}`, kind, title, body, at: minutesAgo(ago), read, href })
  const expiringCount = activeLeases.filter((l) => diffDays(today, l.endDate) <= 30).length
  const notifications: AppNotification[] = [
    n('device_unsynced', 'DEV-05 has not synced in over 2 hours', `Jerome Ticao's phone last synced ${formatDate(today)}; entries are still on the device.`, 20, '/app/collectors/col-05'),
    n('variance', 'Shortage on yesterday’s remittance', 'Marites Fuentes remitted ₱200.00 less than recorded collections.', 95, `/app/reconciliation?date=${addDays(today, -1)}`),
    n('serial_gap', 'Duplicate cash ticket serial', 'Lorna Desales recorded the same cash ticket serial twice yesterday.', 140, '/app/accountable-forms'),
    n('day_not_closed', `${formatDate(addDays(today, -3))} is not yet closed`, 'All remittances are in; one collector has a flagged shortage.', 300, `/app/reconciliation?date=${addDays(today, -3)}`),
    n('lease_expiring', `${expiringCount} leases expire in the next 30 days`, 'Send renewal reminders or prepare renewal contracts.', 60 * 9, '/app/leases?tab=expiring'),
    n('sms_failed', 'SMS reminders failed to send', 'Some overdue reminders this month could not be delivered.', 60 * 26, '/app/messages?status=failed', true),
    n('billing_complete', `Billing for ${formatMonth(currentMonth)} generated`, `${runByMonth.get(currentMonth)?.leaseCount ?? 0} leases billed.`, Math.max(60, diffDays(`${currentMonth}-01`, today) * 1440 + 60), '/app/billing', true),
    n('variance', 'Overage held in trust', `Nenita Balderas remitted ₱40.00 more than recorded on ${formatDate(addDays(today, -17))}.`, 17 * 1440, `/app/reconciliation?date=${addDays(today, -17)}`, true),
  ]

  return {
    today,
    markets,
    sections,
    stalls,
    stallHistory,
    documents,
    lessees,
    leases,
    feeSchedules,
    feeRates,
    collectors,
    devices,
    deviceEvents,
    assignments,
    collections,
    ledgerStart: start,
    legacyMonthly,
    remittances,
    recon,
    dayCloses,
    formSeries,
    formAlerts,
    formTypes: lguConfig.accountableFormTypes.map((f) => ({ ...f })),
    charges,
    payments,
    billingRuns,
    notices,
    smsTemplates,
    smsMessages,
    smsSettings: { ...lguConfig.sms },
    users,
    audit,
    notifications,
    branding: {
      municipality: lguConfig.municipality,
      province: lguConfig.province,
      officeName: lguConfig.officeName,
      publicMarketName: lguConfig.markets[0]?.name ?? 'Public Market',
      seafoodMarketName: lguConfig.markets[1]?.name ?? 'Seafood Market',
      sealDataUrl: null,
    },
    system: {
      lastBackupAt: manilaAt(today, 2, 0),
      backupStatus: 'ok',
      storageUsedMb: 1840,
      storageQuotaMb: 10240,
      devicesOnline: 5,
      devicesTotal: devices.filter((d) => d.status === 'active').length,
      apiVersion: 'mock-1.0',
      appVersion: '0.1.0',
    },
    counters: { audit: audit.length, lease: leases.length, lessee: lessees.length, notice: notices.length, sms: smsMessages.length, rem: remittances.length },
    version: 1,
  }
}

function makePersonName(rng: Rng, pool: string[]): string {
  return rng.pick(pool)
}

