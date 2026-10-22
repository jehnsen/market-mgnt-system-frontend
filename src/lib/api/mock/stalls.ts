import { nowISO } from '@/lib/dates'
import { nextId } from '@/lib/mock/db'
import type { StallsService } from '../contracts'
import { agingFor, ctx, inMarket, leaseView, stallView, statementFor } from './derive'
import { ApiError, audit, currentActor, mutate, requirePermission, required, respond } from './util'
import { quoteFor } from './leases'

export const stallsService: StallsService = {
  markets: () => respond((db) => db.markets),

  sections: (market = 'all') => respond((db) => db.sections.filter((s) => inMarket(market, s.marketId))),

  list: (f) =>
    respond((db) => {
      const q = f.q?.trim().toLowerCase()
      return db.stalls
        .filter((s) => inMarket(f.market, s.marketId))
        .map((s) => stallView(db, s))
        .filter((s) => (f.status && f.status !== 'all' ? s.status === f.status : true))
        .filter((s) => (f.sectionId && f.sectionId !== 'all' ? s.sectionId === f.sectionId : true))
        .filter((s) => (f.inArrears ? s.inArrears : true))
        .filter((s) => (f.expiring ? s.leaseExpiringSoon : true))
        .filter((s) => (q ? s.code.toLowerCase().includes(q) || (s.lesseeName ?? '').toLowerCase().includes(q) : true))
    }),

  get: (id) =>
    respond((db) => {
      const c = ctx(db)
      const stall = required(c.stallById.get(id), 'Stall')
      const view = stallView(db, stall)
      const leases = [...(c.leasesByStall.get(id) ?? [])].sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
      const current = view.lesseeId && stall.currentLeaseId ? c.leaseById.get(stall.currentLeaseId) : undefined
      const ledger = current ? statementFor(db, current.lesseeId, db.today).lines.filter((l) => l.description.includes(stall.code)) : []
      // Re-run the balance on the stall's own lines so it only reflects this stall.
      let bal = 0
      const stallLedger = ledger.map((l) => {
        bal += l.charge - l.payment
        return { ...l, balance: bal }
      })
      const arrears = current ? agingFor(db, current.id) : null
      const payments = current ? [...(c.paymentsByLease.get(current.id) ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5) : []
      let quote: ReturnType<typeof quoteFor> | null = null
      try {
        quote = quoteFor(db, id, db.today)
      } catch {
        quote = null
      }
      return {
        stall: view,
        lease: current ? leaseView(db, current) : null,
        leaseHistory: leases.map((l) => leaseView(db, l)),
        ledger: stallLedger,
        arrears:
          current && arrears && arrears.balance > 0
            ? {
                leaseId: current.id,
                leaseNo: current.leaseNo,
                lesseeId: current.lesseeId,
                lesseeName: view.lesseeName ?? '—',
                stallId: id,
                stallCode: stall.code,
                marketId: stall.marketId,
                sectionId: stall.sectionId,
                sectionName: view.sectionName,
                balance: arrears.balance,
                buckets: arrears.buckets,
                oldestUnpaidMonth: arrears.oldestUnpaidMonth,
                daysOverdue: arrears.daysOverdue,
                lastNotice: db.notices.filter((n) => n.leaseId === current.id).at(-1)?.level ?? null,
              }
            : null,
        recentPayments: payments,
        statusHistory: db.stallHistory.filter((h) => h.stallId === id).sort((a, b) => (a.at < b.at ? 1 : -1)),
        documents: db.documents.filter((d) => d.stallId === id),
        dailyFee: quote?.dailyFee?.amount ?? null,
        monthlyRateQuote: quote?.rate.amount ?? null,
      }
    }),

  setStatus: (id, input) =>
    mutate((db) => {
      requirePermission('stalls.manage')
      const stall = required(ctx(db).stallById.get(id), 'Stall')
      if (stall.status === 'occupied' && input.status !== 'occupied') {
        throw new ApiError('This stall has an active lease. Terminate the lease first.')
      }
      if (input.status === 'occupied') throw new ApiError('A stall becomes occupied only through a new lease.')
      const from = stall.status
      stall.status = input.status
      if (input.status === 'vacant' && !stall.vacantSince) stall.vacantSince = db.today
      db.stallHistory.push({ id: nextId(db, 'ssh'), stallId: id, from, to: input.status, at: nowISO(), byName: currentActor().name, note: input.note })
      audit(db, { action: 'stall.status_changed', entity: 'Stall', entityId: stall.code, summary: `Changed ${stall.code} from ${from} to ${input.status}`, before: { status: from }, after: { status: input.status, note: input.note } })
      return stallView(db, stall)
    }),
}
