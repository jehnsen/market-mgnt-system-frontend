import { addDays, addMonthKey, diffDays, endOfMonth, formatMonth, monthKey, nowISO, startOfMonth } from '@/lib/dates'
import { applyBps, formatPeso, sumBy } from '@/lib/money'
import { type Db, nextId } from '@/lib/mock/db'
import type { AgingBucket, ArrearsAccount, BillingPreview, BillingPreviewLine, DemandNotice, DemandNoticeLevel, DemandNoticeView, ISODate, Lease } from '@/types'
import type { AgingBySection, BillingService, NoticeCandidate } from '../contracts'
import { agingFor, ctx, emptyBuckets, inMarket, leaseEnd, statementFor } from './derive'
import { scheduleOn } from './leases'
import { ApiError, audit, currentActor, mutate, notify, requirePermission, required, respond } from './util'

export function noticeView(db: Db, n: DemandNotice): DemandNoticeView {
  const c = ctx(db)
  const lessee = c.lesseeById.get(n.lesseeId)!
  const stall = c.stallById.get(n.stallId)!
  const aging = agingFor(db, n.leaseId)
  return {
    ...n,
    lesseeName: lessee.fullName,
    lesseeAddress: lessee.address,
    stallCode: stall.code,
    marketId: stall.marketId,
    sectionName: c.sectionById.get(stall.sectionId)!.name,
    monthsOverdue: Math.max(1, Math.ceil(aging.daysOverdue / 30)),
  }
}

/** Unpaid rental (not surcharges) that fell due before a date, after applying payments oldest-first. */
function unpaidRentalBefore(db: Db, leaseId: string, before: ISODate) {
  const c = ctx(db)
  const charges = [...(c.chargesByLease.get(leaseId) ?? [])].sort((a, b) => (a.dueDate === b.dueDate ? (a.kind === 'rental' ? -1 : 1) : a.dueDate < b.dueDate ? -1 : 1))
  let pool = sumBy(c.paymentsByLease.get(leaseId) ?? [], (p) => p.amount)
  let overdue = 0
  for (const ch of charges) {
    const applied = Math.min(pool, ch.amount)
    pool -= applied
    if (ch.kind === 'rental' && ch.dueDate < before) overdue += ch.amount - applied
  }
  return overdue
}

function leaseCoversMonth(l: Lease, month: string) {
  return l.startDate <= endOfMonth(month) && leaseEnd(l) >= startOfMonth(month)
}

function arrearsAccount(db: Db, l: Lease): ArrearsAccount {
  const c = ctx(db)
  const stall = c.stallById.get(l.stallId)!
  const a = agingFor(db, l.id)
  return {
    leaseId: l.id,
    leaseNo: l.leaseNo,
    lesseeId: l.lesseeId,
    lesseeName: c.lesseeById.get(l.lesseeId)?.fullName ?? '—',
    stallId: stall.id,
    stallCode: stall.code,
    marketId: stall.marketId,
    sectionId: stall.sectionId,
    sectionName: c.sectionById.get(stall.sectionId)!.name,
    balance: a.balance,
    buckets: a.buckets,
    oldestUnpaidMonth: a.oldestUnpaidMonth,
    daysOverdue: a.daysOverdue,
    lastNotice: db.notices.filter((n) => n.leaseId === l.id).at(-1)?.level ?? null,
  }
}

function buildPreview(db: Db, month: string): BillingPreview {
  const c = ctx(db)
  const schedule = scheduleOn(db, startOfMonth(month))
  const existing = db.billingRuns.find((r) => r.month === month) ?? null
  const lines: BillingPreviewLine[] = []
  const leases = db.leases.filter((l) => (existing ? true : l.status === 'active') && leaseCoversMonth(l, month))
  for (const l of leases) {
    const stall = c.stallById.get(l.stallId)!
    let rental: number
    let penalty: number
    let overdueRental: number
    if (existing) {
      const charges = (c.chargesByLease.get(l.id) ?? []).filter((ch) => ch.month === month)
      if (charges.length === 0) continue
      rental = sumBy(charges.filter((ch) => ch.kind === 'rental'), (ch) => ch.amount)
      penalty = sumBy(charges.filter((ch) => ch.kind === 'penalty'), (ch) => ch.amount)
      overdueRental = Math.round((penalty * 10_000) / schedule.penaltyRateBps)
    } else {
      rental = l.monthlyRate
      overdueRental = unpaidRentalBefore(db, l.id, startOfMonth(month))
      penalty = applyBps(overdueRental, schedule.penaltyRateBps)
    }
    lines.push({
      leaseId: l.id,
      leaseNo: l.leaseNo,
      stallCode: stall.code,
      marketId: stall.marketId,
      sectionName: c.sectionById.get(stall.sectionId)!.name,
      lesseeName: c.lesseeById.get(l.lesseeId)?.fullName ?? '—',
      rental,
      overdueRental,
      penalty,
      total: rental + penalty,
    })
  }
  lines.sort((a, b) => a.marketId.localeCompare(b.marketId) || a.stallCode.localeCompare(b.stallCode, undefined, { numeric: true }))
  return {
    month,
    alreadyGenerated: existing,
    lines,
    rentalTotal: sumBy(lines, (l) => l.rental),
    penaltyTotal: sumBy(lines, (l) => l.penalty),
    total: sumBy(lines, (l) => l.total),
    penaltyRateBps: schedule.penaltyRateBps,
    ordinanceRef: schedule.penaltyOrdinanceRef,
  }
}

function suggestLevel(db: Db, acc: ArrearsAccount): DemandNoticeLevel | null {
  if (acc.daysOverdue <= 30 || acc.balance <= 0) return null
  const last = db.notices.filter((n) => n.leaseId === acc.leaseId).at(-1)
  if (last && diffDays(last.issuedOn, db.today) < 15) return null
  if (!last) return 'first'
  if (last.level === 'first' && acc.daysOverdue > 60) return 'second'
  if (last.level === 'second' && acc.daysOverdue > 90) return 'final'
  if (last.level === 'final') return null
  return null
}

export const billingService: BillingService = {
  runs: () => respond((db) => [...db.billingRuns].sort((a, b) => (a.month < b.month ? 1 : -1))),

  preview: (month) => respond((db) => buildPreview(db, month)),

  generate: (month) =>
    mutate((db) => {
      requirePermission('billing.run')
      if (db.billingRuns.some((r) => r.month === month)) throw new ApiError(`Billing for ${formatMonth(month)} was already generated.`)
      if (month > addMonthKey(monthKey(db.today), 1)) throw new ApiError('You can generate billing up to one month ahead only.')
      const preview = buildPreview(db, month)
      const run = { id: `br-${month}`, month, generatedAt: nowISO(), generatedByName: currentActor().name, leaseCount: preview.lines.length, rentalTotal: preview.rentalTotal, penaltyTotal: preview.penaltyTotal }
      db.billingRuns.push(run)
      const c = ctx(db)
      for (const line of preview.lines) {
        const lease = c.leaseById.get(line.leaseId)!
        db.charges.push({ id: nextId(db, 'chg'), leaseId: lease.id, lesseeId: lease.lesseeId, stallId: lease.stallId, month, kind: 'rental', amount: line.rental, dueDate: endOfMonth(month), billingRunId: run.id, note: `Stall rental, ${formatMonth(month)}` })
        if (line.penalty > 0) {
          db.charges.push({ id: nextId(db, 'chg'), leaseId: lease.id, lesseeId: lease.lesseeId, stallId: lease.stallId, month, kind: 'penalty', amount: line.penalty, dueDate: endOfMonth(month), billingRunId: run.id, note: `Surcharge 2% on overdue rental of ${formatPeso(line.overdueRental)}` })
        }
      }
      audit(db, { action: 'billing.generated', entity: 'Billing run', entityId: month, summary: `Generated billing for ${formatMonth(month)} (${run.leaseCount} leases)`, before: null, after: { rental: formatPeso(run.rentalTotal), penalty: formatPeso(run.penaltyTotal) } })
      notify(db, { kind: 'billing_complete', title: `Billing for ${formatMonth(month)} generated`, body: `${run.leaseCount} leases billed · ${formatPeso(run.rentalTotal + run.penaltyTotal)} total.`, href: '/app/billing' })
      return run
    }),

  arrears: (f) =>
    respond((db) =>
      db.leases
        .map((l) => arrearsAccount(db, l))
        .filter((a) => a.balance > 0 && inMarket(f.market, a.marketId))
        .filter((a) => (f.sectionId && f.sectionId !== 'all' ? a.sectionId === f.sectionId : true))
        .filter((a) => {
          if (!f.bucket || f.bucket === 'all') return true
          if (f.bucket === 'overdue') return a.balance - a.buckets.current > 0
          return a.buckets[f.bucket] > 0
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance),
    ),

  agingBySection: (market) =>
    respond((db) => {
      const rows = new Map<string, AgingBySection>()
      for (const s of db.sections.filter((x) => inMarket(market, x.marketId) && x.stallCount > 0)) {
        rows.set(s.id, { sectionId: s.id, sectionName: s.name, marketId: s.marketId, buckets: emptyBuckets(), total: 0 })
      }
      for (const l of db.leases) {
        const a = agingFor(db, l.id)
        if (a.balance <= 0) continue
        const row = rows.get(ctx(db).stallById.get(l.stallId)!.sectionId)
        if (!row) continue
        for (const k of Object.keys(a.buckets) as AgingBucket[]) row.buckets[k] += a.buckets[k]
        row.total += a.balance
      }
      return [...rows.values()]
    }),

  statement: (lesseeId, asOf) =>
    respond((db) => {
      required(ctx(db).lesseeById.get(lesseeId), 'Lessee')
      return statementFor(db, lesseeId, asOf ?? db.today)
    }),

  notices: (f) =>
    respond((db) =>
      db.notices
        .map((n) => noticeView(db, n))
        .filter((n) => inMarket(f.market, n.marketId))
        .filter((n) => (f.level && f.level !== 'all' ? n.level === f.level : true))
        .filter((n) => (f.response && f.response !== 'all' ? n.response === f.response : true))
        .sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : a.issuedOn > b.issuedOn ? -1 : b.noticeNo.localeCompare(a.noticeNo))),
    ),

  notice: (id) => respond((db) => noticeView(db, required(db.notices.find((n) => n.id === id), 'Notice'))),

  noticeCandidates: (market) =>
    respond((db) => {
      const out: NoticeCandidate[] = []
      for (const l of db.leases) {
        const acc = arrearsAccount(db, l)
        if (!inMarket(market, acc.marketId)) continue
        const level = suggestLevel(db, acc)
        if (level) out.push({ account: acc, suggestedLevel: level })
      }
      return out.sort((a, b) => b.account.daysOverdue - a.account.daysOverdue)
    }),

  issueNotices: ({ leaseIds }) =>
    mutate((db) => {
      requirePermission('billing.issueNotices')
      const c = ctx(db)
      const issued: DemandNotice[] = []
      for (const id of leaseIds) {
        const lease = required(c.leaseById.get(id), 'Lease')
        const acc = arrearsAccount(db, lease)
        const level = suggestLevel(db, acc)
        if (!level) continue
        const y = db.today.slice(0, 4)
        const seq = db.notices.filter((n) => n.noticeNo.startsWith(`DN-${y}-`)).length + 1
        const n: DemandNotice = {
          id: nextId(db, 'dn'),
          noticeNo: `DN-${y}-${String(seq).padStart(4, '0')}`,
          lesseeId: lease.lesseeId,
          leaseId: lease.id,
          stallId: lease.stallId,
          level,
          amountDue: acc.balance,
          issuedOn: db.today,
          issuedByName: currentActor().name,
          dueBy: addDays(db.today, 15),
          response: 'none',
          responseDate: null,
          responseNote: null,
        }
        db.notices.push(n)
        issued.push(n)
      }
      if (issued.length === 0) throw new ApiError('None of the selected accounts is due for a notice.')
      audit(db, { action: 'notice.issued', entity: 'Demand notice', entityId: issued.map((n) => n.noticeNo).join(', '), summary: `Issued ${issued.length} demand notice(s)`, before: null, after: { count: issued.length } })
      db.version += 1
      return issued.map((n) => noticeView(db, n))
    }),

  recordNoticeResponse: (id, input) =>
    mutate((db) => {
      requirePermission('billing.prepare')
      const n = required(db.notices.find((x) => x.id === id), 'Notice')
      const before = n.response
      n.response = input.response
      n.responseDate = input.response === 'none' ? null : db.today
      n.responseNote = input.note.trim() || null
      audit(db, { action: 'notice.response', entity: 'Demand notice', entityId: n.noticeNo, summary: `Recorded response "${input.response}" on ${n.noticeNo}`, before: { response: before }, after: { response: n.response, note: n.responseNote } })
      return noticeView(db, n)
    }),

  penaltyPolicy: () => respond((db) => ({ schedule: scheduleOn(db, db.today) })),
}
