import { lguConfig } from '@/config/lgu'
import { addMonthKey, diffDays, endOfMonth, formatMonth, monthKey } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import { type Db, reconKey } from '@/lib/mock/db'
import type {
  AgingBucket,
  Centavos,
  Charge,
  Collection,
  CollectionStatus,
  CollectionView,
  Collector,
  CollectorView,
  ISODate,
  Lease,
  LeaseView,
  Lessee,
  LesseeView,
  MarketScope,
  MonthKey,
  Payment,
  ReconciliationDay,
  Remittance,
  Section,
  SerialUsage,
  Stall,
  StallView,
  StatementLine,
  StatementOfAccount,
} from '@/types'

/* ------------------------------------------------------------- context */

export interface Aging {
  balance: Centavos
  overdue: Centavos
  buckets: Record<AgingBucket, Centavos>
  oldestUnpaidMonth: MonthKey | null
  daysOverdue: number
}

interface Ctx {
  db: Db
  version: number
  stallById: Map<string, Stall>
  sectionById: Map<string, Section>
  lesseeById: Map<string, Lessee>
  leaseById: Map<string, Lease>
  collectorById: Map<string, Collector>
  collectionById: Map<string, Collection>
  chargesByLease: Map<string, Charge[]>
  paymentsByLease: Map<string, Payment[]>
  leasesByStall: Map<string, Lease[]>
  leasesByLessee: Map<string, Lease[]>
  collectionsByDay: Map<ISODate, Collection[]>
  collectionsByCollectorDay: Map<string, Collection[]>
  correctionsByOriginal: Map<string, Collection[]>
  remittancesByKey: Map<string, Remittance[]>
  dupKeys: Set<string>
  aging: Map<string, Aging>
}

let cache: Ctx | null = null

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function ctx(db: Db): Ctx {
  if (cache && cache.db === db && cache.version === db.version) return cache
  const c: Ctx = {
    db,
    version: db.version,
    stallById: new Map(db.stalls.map((x) => [x.id, x])),
    sectionById: new Map(db.sections.map((x) => [x.id, x])),
    lesseeById: new Map(db.lessees.map((x) => [x.id, x])),
    leaseById: new Map(db.leases.map((x) => [x.id, x])),
    collectorById: new Map(db.collectors.map((x) => [x.id, x])),
    collectionById: new Map(db.collections.map((x) => [x.id, x])),
    chargesByLease: new Map(),
    paymentsByLease: new Map(),
    leasesByStall: new Map(),
    leasesByLessee: new Map(),
    collectionsByDay: new Map(),
    collectionsByCollectorDay: new Map(),
    correctionsByOriginal: new Map(),
    remittancesByKey: new Map(),
    dupKeys: new Set(),
    aging: new Map(),
  }
  for (const ch of db.charges) push(c.chargesByLease, ch.leaseId, ch)
  for (const p of db.payments) push(c.paymentsByLease, p.leaseId, p)
  for (const l of db.leases) {
    push(c.leasesByStall, l.stallId, l)
    push(c.leasesByLessee, l.lesseeId, l)
  }
  const seen = new Set<string>()
  for (const col of db.collections) {
    push(c.collectionsByDay, col.businessDate, col)
    push(c.collectionsByCollectorDay, reconKey(col.collectorId, col.businessDate), col)
    if (col.correctsCollectionId) {
      push(c.correctionsByOriginal, col.correctsCollectionId, col)
      continue
    }
    const k = `${col.collectorId}|${col.formType}|${col.receiptSerial}`
    if (seen.has(k)) c.dupKeys.add(k)
    else seen.add(k)
  }
  for (const r of db.remittances) push(c.remittancesByKey, reconKey(r.collectorId, r.businessDate), r)
  cache = c
  return c
}

/** Call after every mutation so derived views refresh. */
export function touch(db: Db) {
  db.version += 1
}

export function inMarket(scope: MarketScope, marketId: string) {
  return scope === 'all' || scope === marketId
}

/* -------------------------------------------------------------- leases */

export function leaseEnd(l: Lease): ISODate {
  return l.terminatedOn ?? l.endDate
}

export function bucketFor(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return 'd1_30'
  if (daysOverdue <= 60) return 'd31_60'
  if (daysOverdue <= 90) return 'd61_90'
  return 'd90_plus'
}

export const emptyBuckets = (): Record<AgingBucket, Centavos> => ({ current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 })

/** Payments are applied to the oldest charges first (FIFO); what is left is aged by due date. */
export function agingFor(db: Db, leaseId: string): Aging {
  const c = ctx(db)
  const hit = c.aging.get(leaseId)
  if (hit) return hit
  const charges = [...(c.chargesByLease.get(leaseId) ?? [])].sort((a, b) =>
    a.dueDate === b.dueDate ? (a.kind === b.kind ? 0 : a.kind === 'rental' ? -1 : 1) : a.dueDate < b.dueDate ? -1 : 1,
  )
  let pool = sumBy(c.paymentsByLease.get(leaseId) ?? [], (p) => p.amount)
  const buckets = emptyBuckets()
  let oldest: MonthKey | null = null
  let daysOverdue = 0
  let balance = 0
  for (const ch of charges) {
    const applied = Math.min(pool, ch.amount)
    pool -= applied
    const unpaid = ch.amount - applied
    if (unpaid <= 0) continue
    balance += unpaid
    const days = diffDays(ch.dueDate, db.today)
    buckets[bucketFor(days)] += unpaid
    if (!oldest) {
      oldest = ch.month
      daysOverdue = Math.max(0, days)
    }
  }
  balance -= pool
  const result: Aging = {
    balance,
    overdue: balance > 0 ? balance - buckets.current : 0,
    buckets,
    oldestUnpaidMonth: oldest,
    daysOverdue,
  }
  c.aging.set(leaseId, result)
  return result
}

export function leaseView(db: Db, l: Lease): LeaseView {
  const c = ctx(db)
  const stall = c.stallById.get(l.stallId)!
  const section = c.sectionById.get(stall.sectionId)!
  return {
    ...l,
    stallCode: stall.code,
    marketId: stall.marketId,
    sectionId: section.id,
    sectionName: section.name,
    lesseeName: c.lesseeById.get(l.lesseeId)?.fullName ?? '—',
    daysToExpiry: diffDays(db.today, l.endDate),
    balance: agingFor(db, l.id).balance,
  }
}

/* -------------------------------------------------------------- stalls */

export function stallView(db: Db, s: Stall): StallView {
  const c = ctx(db)
  const section = c.sectionById.get(s.sectionId)!
  const lease = s.currentLeaseId ? c.leaseById.get(s.currentLeaseId) : undefined
  const active = lease && lease.status === 'active' ? lease : undefined
  const aging = active ? agingFor(db, active.id) : null
  const days = active ? diffDays(db.today, active.endDate) : null
  return {
    ...s,
    sectionName: section.name,
    sectionCategory: section.category,
    lesseeId: active?.lesseeId ?? null,
    lesseeName: active ? (c.lesseeById.get(active.lesseeId)?.fullName ?? null) : null,
    monthlyRate: active?.monthlyRate ?? null,
    balance: aging?.balance ?? 0,
    leaseEnd: active?.endDate ?? null,
    leaseExpiringSoon: days !== null && days >= 0 && days <= 30,
    inArrears: (aging?.overdue ?? 0) > 0,
    daysVacant: s.status === 'vacant' && s.vacantSince ? diffDays(s.vacantSince, db.today) : null,
  }
}

/* ------------------------------------------------------------- lessees */

export function lesseeView(db: Db, l: Lessee): LesseeView {
  const c = ctx(db)
  const leases = c.leasesByLessee.get(l.id) ?? []
  const active = leases.filter((x) => x.status === 'active')
  let balance = 0
  let oldest: string | null = null
  for (const lease of leases) {
    const a = agingFor(db, lease.id)
    balance += a.balance
    if (a.oldestUnpaidMonth && (!oldest || a.oldestUnpaidMonth < oldest)) oldest = a.oldestUnpaidMonth
  }
  const expiring = active.some((x) => diffDays(db.today, x.endDate) <= 30)
  return {
    ...l,
    stallIds: active.map((x) => x.stallId),
    stallCodes: active.map((x) => c.stallById.get(x.stallId)!.code),
    balance,
    oldestUnpaidMonth: oldest,
    leaseStatus: active.length === 0 ? (leases.length ? 'expired' : 'none') : expiring ? 'expiring' : 'active',
  }
}

/* --------------------------------------------------------- collections */

export function countedAmount(c: Collection): Centavos {
  if (c.correctsCollectionId && c.correctionStatus !== 'approved') return 0
  return c.amount
}

export function collectionStatus(db: Db, col: Collection): CollectionStatus {
  if (!col.synced) return 'pending_sync'
  if (col.correctsCollectionId) return col.correctionStatus === 'approved' ? 'corrected' : 'synced'
  if (col.correctedByCollectionId) {
    const corr = ctx(db).collectionById.get(col.correctedByCollectionId)
    if (corr?.correctionStatus === 'approved') return 'corrected'
  }
  const rec = db.recon.get(reconKey(col.collectorId, col.businessDate))
  if (!rec) return 'synced'
  const s = rec.status === 'closed' ? rec.statusBeforeClose : rec.status
  if (s === 'balanced') return 'reconciled'
  if (s === 'shortage' || s === 'overage') return 'variance'
  return rec.status === 'closed' ? 'reconciled' : 'synced'
}

export function collectionView(db: Db, col: Collection): CollectionView {
  const c = ctx(db)
  const collector = c.collectorById.get(col.collectorId)
  const stall = col.stallId ? c.stallById.get(col.stallId) : undefined
  const lessee = col.lesseeId ? c.lesseeById.get(col.lesseeId) : undefined
  return {
    ...col,
    status: collectionStatus(db, col),
    collectorName: collector?.fullName ?? '—',
    sectionName: c.sectionById.get(col.sectionId)?.name ?? '—',
    stallCode: stall?.code ?? null,
    payerName: lessee?.fullName ?? col.transientVendorName ?? '—',
    countedAmount: countedAmount(col),
    isDuplicateSerial: !col.correctsCollectionId && c.dupKeys.has(`${col.collectorId}|${col.formType}|${col.receiptSerial}`),
  }
}

/* ------------------------------------------------------ reconciliation */

export function collectorSections(db: Db, collectorId: string): Section[] {
  const c = ctx(db)
  return db.assignments
    .filter((a) => a.collectorId === collectorId && a.effectiveTo === null)
    .map((a) => c.sectionById.get(a.sectionId))
    .filter((s): s is Section => Boolean(s))
}

export function formLabel(formType: string): string {
  return lguConfig.accountableFormTypes.find((f) => f.id === formType)?.prefix ?? formType.toUpperCase()
}

function serialUsage(db: Db, collectorId: string, items: Collection[]): SerialUsage[] {
  const byForm = new Map<string, Collection[]>()
  for (const it of items) if (!it.correctsCollectionId) push(byForm, it.formType, it)
  const out: SerialUsage[] = []
  for (const [formType, list] of byForm) {
    const sorted = [...list].sort((a, b) => Number(a.receiptSerial) - Number(b.receiptSerial) || (a.recordedAt < b.recordedAt ? -1 : 1))
    const counts = new Map<string, number>()
    for (const it of sorted) counts.set(it.receiptSerial, (counts.get(it.receiptSerial) ?? 0) + 1)
    const nums = [...new Set(sorted.map((x) => Number(x.receiptSerial)))]
    const first = nums[0] ?? null
    const last = nums[nums.length - 1] ?? null
    const width = sorted[0]?.receiptSerial.length ?? 7
    const gaps: string[] = []
    for (let i = 1; i < nums.length && gaps.length < 50; i++) {
      for (let n = nums[i - 1]! + 1; n < nums[i]! && gaps.length < 50; n++) gaps.push(String(n).padStart(width, '0'))
    }
    let prev: number | null = null
    const sequence = sorted.map((it) => {
      const n = Number(it.receiptSerial)
      const gap = prev !== null && n > prev + 1
      prev = n
      return { serial: it.receiptSerial, collectionId: it.id, amount: countedAmount(it), gap, duplicate: (counts.get(it.receiptSerial) ?? 0) > 1 }
    })
    const series = first !== null ? db.formSeries.find((s) => s.issuedTo === collectorId && s.formType === formType && s.start <= first && s.end >= first) : undefined
    out.push({
      formType,
      first: first !== null ? String(first).padStart(width, '0') : null,
      last: last !== null ? String(last).padStart(width, '0') : null,
      count: sorted.length,
      gaps,
      duplicates: [...counts.entries()].filter(([, n]) => n > 1).map(([s]) => s),
      sequence,
      issuedRange: series ? `${String(series.start).padStart(width, '0')}–${String(series.end).padStart(width, '0')}` : null,
    })
  }
  return out.sort((a, b) => (a.formType < b.formType ? 1 : -1))
}

export function reconRow(db: Db, collectorId: string, date: ISODate): ReconciliationDay {
  const c = ctx(db)
  const key = reconKey(collectorId, date)
  const items = c.collectionsByCollectorDay.get(key) ?? []
  const remittances = c.remittancesByKey.get(key) ?? []
  const expected = sumBy(items, countedAmount)
  const remitted = sumBy(remittances, (r) => r.amount)
  const rec = db.recon.get(key)
  const collector = c.collectorById.get(collectorId)!
  return {
    collectorId,
    collectorName: collector.fullName,
    date,
    marketId: collector.marketId,
    sectionNames: collectorSections(db, collectorId).map((s) => s.name),
    collectionsCount: items.filter((x) => !x.correctsCollectionId).length,
    pendingSyncCount: items.filter((x) => !x.synced).length,
    expected,
    remitted,
    variance: remitted - expected,
    status: rec?.status ?? 'open',
    statusBeforeClose: rec?.statusBeforeClose ?? null,
    flagReason: rec?.flagReason ?? null,
    markedByName: rec?.markedByName ?? null,
    notes: rec?.notes ?? '',
    serials: serialUsage(db, collectorId, items),
    remittances,
  }
}

export function collectorsWithActivity(db: Db, date: ISODate, market: MarketScope): Collector[] {
  const c = ctx(db)
  const ids = new Set<string>()
  for (const col of c.collectionsByDay.get(date) ?? []) ids.add(col.collectorId)
  for (const r of db.remittances) if (r.businessDate === date) ids.add(r.collectorId)
  if (date === db.today) for (const col of db.collectors) if (col.status === 'active') ids.add(col.id)
  return db.collectors.filter((x) => ids.has(x.id) && inMarket(market, x.marketId))
}

/* ---------------------------------------------------------- collectors */

export function collectorView(db: Db, col: Collector, date: ISODate): CollectorView {
  const device = col.deviceId ? (db.devices.find((d) => d.id === col.deviceId) ?? null) : null
  const row = reconRow(db, col.id, date)
  const sections = collectorSections(db, col.id)
  const lastSync = device?.lastSyncAt ?? null
  const unsynced = device ? (ctx(db).collectionsByCollectorDay.get(reconKey(col.id, db.today)) ?? []).filter((x) => !x.synced).length : 0
  return {
    ...col,
    device,
    sectionIds: sections.map((s) => s.id),
    sectionNames: sections.map((s) => s.name),
    todayCount: row.collectionsCount,
    todayTotal: row.expected,
    todayRemitted: row.remitted,
    todayVariance: row.variance,
    lastSyncAt: lastSync,
    unsyncedCount: unsynced,
    syncStale: device?.status === 'active' && lastSync !== null && Date.now() - new Date(lastSync).getTime() > 2 * 3600_000,
  }
}

/* ------------------------------------------------------------- totals */

export function dayTotal(db: Db, date: ISODate, market: MarketScope, cutoffMinutes?: number): Centavos {
  let total = 0
  for (const col of ctx(db).collectionsByDay.get(date) ?? []) {
    if (!inMarket(market, col.marketId)) continue
    if (cutoffMinutes !== undefined) {
      const t = new Date(col.recordedAt)
      const mins = ((t.getUTCHours() + 8) % 24) * 60 + t.getUTCMinutes()
      if (mins > cutoffMinutes) continue
    }
    total += countedAmount(col)
  }
  return total
}

/** Month total combining migrated history and synced collections. */
export function monthTotal(db: Db, month: MonthKey, market: MarketScope, filter?: { sectionId?: string; type?: Collection['type'] }): Centavos {
  let total = 0
  for (const row of db.legacyMonthly) {
    if (row.month !== month || !inMarket(market, row.marketId)) continue
    if (filter?.sectionId && row.sectionId !== filter.sectionId) continue
    if (filter?.type && row.type !== filter.type) continue
    total += row.amount
  }
  if (endOfMonth(month) < db.ledgerStart) return total
  const c = ctx(db)
  for (const [date, list] of c.collectionsByDay) {
    if (monthKey(date) !== month) continue
    for (const col of list) {
      if (!inMarket(market, col.marketId)) continue
      if (filter?.sectionId && col.sectionId !== filter.sectionId) continue
      if (filter?.type && col.type !== filter.type) continue
      total += countedAmount(col)
    }
  }
  return total
}

export function monthTarget(db: Db, month: MonthKey, market: MarketScope): Centavos {
  const lastYear = monthTotal(db, addMonthKey(month, -12), market)
  const raw = Math.round((lastYear * 106) / 100)
  return Math.round(raw / 100_000) * 100_000
}

/* ----------------------------------------------------------- statement */

export function statementFor(db: Db, lesseeId: string, asOf: ISODate): StatementOfAccount {
  const c = ctx(db)
  const lessee = c.lesseeById.get(lesseeId)!
  const leases = c.leasesByLessee.get(lesseeId) ?? []
  type Raw = { date: ISODate; order: number; description: string; reference: string; charge: Centavos; payment: Centavos }
  const raw: Raw[] = []
  for (const lease of leases) {
    const stall = c.stallById.get(lease.stallId)!
    for (const ch of c.chargesByLease.get(lease.id) ?? []) {
      const date = `${ch.month}-01`
      if (date > asOf) continue
      raw.push({
        date,
        order: ch.kind === 'rental' ? 0 : 1,
        description: ch.kind === 'rental' ? `Stall ${stall.code} rental — ${formatMonth(ch.month)}` : `Surcharge ${stall.code} — ${ch.note.replace(/^Surcharge /, '')}`,
        reference: lease.leaseNo,
        charge: ch.amount,
        payment: 0,
      })
    }
    for (const p of c.paymentsByLease.get(lease.id) ?? []) {
      if (p.date > asOf) continue
      raw.push({
        date: p.date,
        order: 2,
        description: `Payment — ${p.kind === 'rental' ? 'rental' : 'surcharge'}, stall ${stall.code}${p.source === 'treasury_window' ? ' (Treasury window)' : ''}`,
        reference: `OR ${p.receiptSerial}`,
        charge: 0,
        payment: p.amount,
      })
    }
  }
  raw.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1))
  let balance = 0
  const lines: StatementLine[] = raw.map((r) => {
    balance += r.charge - r.payment
    return { date: r.date, description: r.description, reference: r.reference, charge: r.charge, payment: r.payment, balance }
  })
  const aging = emptyBuckets()
  for (const lease of leases) {
    const a = agingFor(db, lease.id)
    for (const k of Object.keys(aging) as AgingBucket[]) aging[k] += a.buckets[k]
  }
  return {
    lesseeId,
    lesseeName: lessee.fullName,
    address: lessee.address,
    stalls: leases
      .filter((l) => l.status === 'active')
      .map((l) => {
        const stall = c.stallById.get(l.stallId)!
        return { code: stall.code, marketId: stall.marketId, sectionName: c.sectionById.get(stall.sectionId)!.name, leaseNo: l.leaseNo, monthlyRate: l.monthlyRate }
      }),
    asOf,
    periodFrom: lines[0]?.date ?? asOf,
    openingBalance: 0,
    lines,
    totalCharges: sumBy(lines, (l) => l.charge),
    totalPayments: sumBy(lines, (l) => l.payment),
    closingBalance: balance,
    aging,
  }
}

export { reconKey }
