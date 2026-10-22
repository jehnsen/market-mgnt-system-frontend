import { addDays, addMonths, formatDate, formatMonth, monthKey, nowISO } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import { type Db, nextId } from '@/lib/mock/db'
import type { FeeKind, ISODate, Lease, Lessee } from '@/types'
import type { LeasesService, LesseeInput, RateQuote } from '../contracts'
import { ctx, leaseView, stallView } from './derive'
import { ApiError, audit, currentActor, mutate, requirePermission, required, respond } from './util'

export function scheduleOn(db: Db, date: ISODate) {
  const s = [...db.feeSchedules]
    .filter((x) => x.effectiveFrom <= date && (x.effectiveTo === null || x.effectiveTo >= date))
    .sort((a, b) => b.version - a.version)[0]
  return required(s, 'Fee schedule')
}

export function rateFor(db: Db, scheduleId: string, stallId: string, kind: FeeKind) {
  const c = ctx(db)
  const stall = required(c.stallById.get(stallId), 'Stall')
  const cat = c.sectionById.get(stall.sectionId)!.category
  const candidates = db.feeRates.filter((r) => r.scheduleId === scheduleId && r.marketId === stall.marketId && r.sectionCategory === cat && r.kind === kind)
  return candidates.find((r) => r.stallType === stall.type) ?? candidates.find((r) => r.stallType === null) ?? null
}

export function quoteFor(db: Db, stallId: string, date: ISODate): RateQuote {
  const schedule = scheduleOn(db, date)
  const rate = rateFor(db, schedule.id, stallId, 'monthly_rental')
  if (!rate) throw new ApiError('No rental rate configured for this stall type.')
  return { rate, schedule, dailyFee: rateFor(db, schedule.id, stallId, 'daily_fee') }
}

export function createLessee(db: Db, input: LesseeInput): Lessee {
  const id = `les-${String((db.counters.lessee = (db.counters.lessee ?? db.lessees.length) + 1)).padStart(3, '0')}`
  const lessee: Lessee = {
    id,
    firstName: input.firstName.trim(),
    middleInitial: input.middleInitial.trim().replace('.', ''),
    lastName: input.lastName.trim(),
    fullName: `${input.firstName.trim()}${input.middleInitial.trim() ? ` ${input.middleInitial.trim().replace('.', '')}.` : ''} ${input.lastName.trim()}`,
    businessName: input.businessName.trim() || null,
    contactNumber: input.contactNumber.trim(),
    email: input.email.trim() || null,
    address: input.address.trim(),
    smsConsent: input.smsConsent,
    smsConsentAt: input.smsConsent ? nowISO() : null,
    registeredOn: db.today,
    notes: input.notes.trim() || null,
  }
  db.lessees.push(lessee)
  audit(db, { action: 'lessee.created', entity: 'Lessee', entityId: id, summary: `Registered lessee ${lessee.fullName}`, before: null, after: { smsConsent: lessee.smsConsent } })
  return lessee
}

function nextLeaseNo(db: Db, start: ISODate) {
  const y = start.slice(0, 4)
  const n = db.leases.filter((l) => l.leaseNo.startsWith(`L-${y}-`)).length + 1
  return `L-${y}-${String(n).padStart(4, '0')}`
}

function addLease(db: Db, input: Omit<Lease, 'id' | 'leaseNo' | 'createdAt' | 'createdByName' | 'feeScheduleVersionId' | 'feeRateId' | 'endDate'>): Lease {
  const quote = quoteFor(db, input.stallId, input.startDate)
  const lease: Lease = {
    ...input,
    id: nextId(db, 'lea'),
    leaseNo: nextLeaseNo(db, input.startDate),
    endDate: addDays(addMonths(input.startDate, input.termMonths), -1),
    feeScheduleVersionId: quote.schedule.id,
    feeRateId: quote.rate.id,
    createdAt: nowISO(),
    createdByName: currentActor().name,
  }
  db.leases.push(lease)
  // Bill the start month right away if it has already been billed for everyone else.
  const month = monthKey(lease.startDate)
  if (db.billingRuns.some((r) => r.month === month)) {
    db.charges.push({
      id: nextId(db, 'chg'),
      leaseId: lease.id,
      lesseeId: lease.lesseeId,
      stallId: lease.stallId,
      month,
      kind: 'rental',
      amount: lease.monthlyRate,
      dueDate: addDays(addMonths(`${month}-01`, 1), -1),
      billingRunId: null,
      note: `Stall rental, ${formatMonth(month)}`,
    })
  }
  db.documents.push({ id: nextId(db, 'doc'), stallId: lease.stallId, lesseeId: lease.lesseeId, name: `Lease contract ${lease.leaseNo}.pdf`, kind: 'lease_contract', uploadedAt: nowISO(), sizeKb: 240 })
  return lease
}

export const leasesService: LeasesService = {
  list: (f) =>
    respond((db) => {
      const q = f.q?.trim().toLowerCase()
      const within = f.withinDays ?? 30
      return db.leases
        .map((l) => leaseView(db, l))
        .filter((l) => (f.market === 'all' ? true : l.marketId === f.market))
        .filter((l) => {
          if (f.tab === 'active') return l.status === 'active'
          if (f.tab === 'expiring') return l.status === 'active' && l.daysToExpiry >= 0 && l.daysToExpiry <= within
          return l.status === f.tab
        })
        .filter((l) => (q ? `${l.leaseNo} ${l.stallCode} ${l.lesseeName}`.toLowerCase().includes(q) : true))
        .sort((a, b) => (f.tab === 'expiring' ? a.daysToExpiry - b.daysToExpiry : a.startDate < b.startDate ? 1 : -1))
    }),

  get: (id) =>
    respond((db) => {
      const c = ctx(db)
      const lease = required(c.leaseById.get(id), 'Lease')
      const stall = c.stallById.get(lease.stallId)!
      const schedule = required(db.feeSchedules.find((s) => s.id === lease.feeScheduleVersionId), 'Fee schedule')
      const rate = required(db.feeRates.find((r) => r.id === lease.feeRateId), 'Fee rate')
      return {
        lease: leaseView(db, lease),
        stall: stallView(db, stall),
        lessee: c.lesseeById.get(lease.lesseeId)!,
        quote: { schedule, rate, dailyFee: rateFor(db, schedule.id, stall.id, 'daily_fee') },
        history: (c.leasesByStall.get(stall.id) ?? []).filter((l) => l.id !== id).map((l) => leaseView(db, l)),
      }
    }),

  quote: (stallId, onDate) => respond((db) => quoteFor(db, stallId, onDate)),

  create: (input) =>
    mutate((db) => {
      requirePermission('leases.manage')
      const c = ctx(db)
      const stall = required(c.stallById.get(input.stallId), 'Stall')
      if (stall.status !== 'vacant' && stall.status !== 'reserved') throw new ApiError(`Stall ${stall.code} is not available.`)
      if (input.termMonths < 1 || input.termMonths > 60) throw new ApiError('Lease term must be between 1 and 60 months.')
      const lessee = input.lesseeId ? required(c.lesseeById.get(input.lesseeId), 'Lessee') : createLessee(db, required(input.newLessee, 'Lessee details'))
      const lease = addLease(db, {
        stallId: stall.id,
        lesseeId: lessee.id,
        startDate: input.startDate,
        termMonths: input.termMonths,
        monthlyRate: input.monthlyRate,
        deposit: input.deposit,
        status: 'active',
        specialConditions: input.specialConditions.trim(),
        renewedFromLeaseId: null,
        terminatedOn: null,
        terminationReason: null,
      })
      const from = stall.status
      stall.status = 'occupied'
      stall.currentLeaseId = lease.id
      stall.vacantSince = null
      db.stallHistory.push({ id: nextId(db, 'ssh'), stallId: stall.id, from, to: 'occupied', at: nowISO(), byName: currentActor().name, note: `Lease ${lease.leaseNo} created` })
      audit(db, { action: 'lease.created', entity: 'Lease', entityId: lease.leaseNo, summary: `Created lease ${lease.leaseNo} for stall ${stall.code} (${lessee.fullName})`, before: null, after: { monthlyRate: formatPeso(lease.monthlyRate), start: lease.startDate, end: lease.endDate } })
      return leaseView(db, lease)
    }),

  renew: (id, input) =>
    mutate((db) => {
      requirePermission('leases.manage')
      const c = ctx(db)
      const old = required(c.leaseById.get(id), 'Lease')
      if (old.status !== 'active') throw new ApiError('Only an active lease can be renewed.')
      const stall = c.stallById.get(old.stallId)!
      old.status = 'expired'
      const lease = addLease(db, {
        stallId: old.stallId,
        lesseeId: old.lesseeId,
        startDate: input.startDate,
        termMonths: input.termMonths,
        monthlyRate: input.monthlyRate,
        deposit: old.deposit,
        status: 'active',
        specialConditions: old.specialConditions,
        renewedFromLeaseId: old.id,
        terminatedOn: null,
        terminationReason: null,
      })
      stall.currentLeaseId = lease.id
      audit(db, { action: 'lease.renewed', entity: 'Lease', entityId: lease.leaseNo, summary: `Renewed ${old.leaseNo} as ${lease.leaseNo} (${input.reason || 'renewal'})`, before: { endDate: old.endDate, monthlyRate: formatPeso(old.monthlyRate) }, after: { endDate: lease.endDate, monthlyRate: formatPeso(lease.monthlyRate) } })
      return leaseView(db, lease)
    }),

  terminate: (id, input) =>
    mutate((db) => {
      requirePermission('leases.manage')
      const c = ctx(db)
      const lease = required(c.leaseById.get(id), 'Lease')
      if (lease.status !== 'active') throw new ApiError('Only an active lease can be terminated.')
      if (!input.reason.trim()) throw new ApiError('A reason is required.')
      const stall = c.stallById.get(lease.stallId)!
      lease.status = 'terminated'
      lease.terminatedOn = input.effectiveDate
      lease.terminationReason = input.reason.trim()
      stall.status = 'vacant'
      stall.currentLeaseId = null
      stall.vacantSince = input.effectiveDate
      db.stallHistory.push({ id: nextId(db, 'ssh'), stallId: stall.id, from: 'occupied', to: 'vacant', at: nowISO(), byName: currentActor().name, note: `Lease ${lease.leaseNo} terminated effective ${formatDate(input.effectiveDate)}` })
      audit(db, { action: 'lease.terminated', entity: 'Lease', entityId: lease.leaseNo, summary: `Terminated ${lease.leaseNo} effective ${formatDate(input.effectiveDate)}`, before: { status: 'active' }, after: { status: 'terminated', reason: lease.terminationReason } })
      return leaseView(db, lease)
    }),
}
