import { addMonthKey, daysInMonth, diffDays, endOfMonth, formatMonthShort, monthKey } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import type { AgingBucket, CollectionType } from '@/types'
import type { ReportsService } from '../contracts'
import { agingFor, collectorsWithActivity, countedAmount, ctx, emptyBuckets, inMarket, monthTotal, reconRow } from './derive'
import { occupancyOn } from './dashboard'
import { scheduleOn } from './leases'
import { respond } from './util'

const TYPES: CollectionType[] = ['daily_fee', 'monthly_rental', 'transient_fee', 'penalty', 'other']
const zeroTypes = (): Record<CollectionType, number> => ({ daily_fee: 0, monthly_rental: 0, transient_fee: 0, penalty: 0, other: 0 })

export const reportsService: ReportsService = {
  daily: (date, market) =>
    respond((db) => {
      const c = ctx(db)
      const rows = collectorsWithActivity(db, date, market).map((col) => {
        const items = (c.collectionsByDay.get(date) ?? []).filter((x) => x.collectorId === col.id)
        const byType = zeroTypes()
        for (const it of items) byType[it.type] += countedAmount(it)
        const row = reconRow(db, col.id, date)
        return { collectorId: col.id, collectorName: col.fullName, byType, count: row.collectionsCount, total: row.expected, remitted: row.remitted, variance: row.remittances.length ? row.variance : 0 }
      })
      return { date, rows }
    }),

  monthlyBySection: (month, market) =>
    respond((db) => ({
      month,
      rows: db.sections
        .filter((s) => inMarket(market, s.marketId))
        .map((s) => {
          const byType = zeroTypes()
          for (const t of TYPES) byType[t] = monthTotal(db, month, market, { sectionId: s.id, type: t })
          return { sectionId: s.id, sectionName: s.name, marketId: s.marketId, byType, total: sumBy(TYPES, (t) => byType[t]), previous: monthTotal(db, addMonthKey(month, -1), market, { sectionId: s.id }) }
        }),
    })),

  collectorPerformance: (month, market) =>
    respond((db) => {
      const c = ctx(db)
      const days = daysInMonth(month).filter((d) => d <= db.today && d >= db.ledgerStart)
      return {
        month,
        rows: db.collectors
          .filter((col) => inMarket(market, col.marketId))
          .map((col) => {
            let collections = 0
            let amount = 0
            let activeDays = 0
            let shortageDays = 0
            let shortage = 0
            let overage = 0
            let delaySum = 0
            let delayN = 0
            for (const d of days) {
              const items = (c.collectionsByDay.get(d) ?? []).filter((x) => x.collectorId === col.id)
              if (items.length === 0) continue
              activeDays++
              const row = reconRow(db, col.id, d)
              collections += row.collectionsCount
              amount += row.expected
              if (row.remittances.length && row.variance < 0) {
                shortageDays++
                shortage += row.variance
              }
              if (row.remittances.length && row.variance > 0) overage += row.variance
              for (const it of items) {
                if (!it.syncedAt || it.correctsCollectionId) continue
                delaySum += (new Date(it.syncedAt).getTime() - new Date(it.recordedAt).getTime()) / 60_000
                delayN++
              }
            }
            return { collectorId: col.id, collectorName: col.fullName, days: activeDays, collections, amount, shortageDays, shortage, overage, avgSyncDelayMin: delayN ? Math.round(delaySum / delayN) : 0 }
          }),
      }
    }),

  occupancy: (market) =>
    respond((db) => {
      const c = ctx(db)
      const history = []
      for (let i = 11; i >= 0; i--) {
        const m = addMonthKey(monthKey(db.today), -i)
        const o = occupancyOn(db, i === 0 ? db.today : endOfMonth(m), market)
        history.push({ month: m, ...o })
      }
      const bySection = db.sections
        .filter((s) => inMarket(market, s.marketId) && s.stallCount > 0)
        .map((s) => {
          const stalls = db.stalls.filter((x) => x.sectionId === s.id)
          return {
            sectionId: s.id,
            sectionName: s.name,
            marketId: s.marketId,
            occupied: stalls.filter((x) => x.status === 'occupied').length,
            vacant: stalls.filter((x) => x.status === 'vacant').length,
            reserved: stalls.filter((x) => x.status === 'reserved').length,
            repair: stalls.filter((x) => x.status === 'under_repair').length,
            total: stalls.length,
          }
        })
      const schedule = scheduleOn(db, db.today)
      const vacant = db.stalls
        .filter((s) => inMarket(market, s.marketId) && s.status !== 'occupied')
        .map((s) => {
          const section = c.sectionById.get(s.sectionId)!
          const rates = db.feeRates.filter((r) => r.scheduleId === schedule.id && r.kind === 'monthly_rental' && r.marketId === s.marketId && r.sectionCategory === section.category)
          const rate = rates.find((r) => r.stallType === s.type) ?? rates[0]
          return { stallId: s.id, code: s.code, sectionName: section.name, marketId: s.marketId, status: s.status, since: s.vacantSince, days: s.vacantSince ? diffDays(s.vacantSince, db.today) : 0, monthlyRate: rate?.amount ?? 0 }
        })
        .sort((a, b) => b.days - a.days)
      return { history, bySection, vacant }
    }),

  yearlyTrend: (year, market) =>
    respond((db) => {
      const current = monthKey(db.today)
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = `${year}-${String(i + 1).padStart(2, '0')}`
        const prev = `${year - 1}-${String(i + 1).padStart(2, '0')}`
        return { month: m, label: formatMonthShort(m).slice(0, 3), current: m <= current ? monthTotal(db, m, market) : null, previous: monthTotal(db, prev, market) }
      })
      const elapsed = months.filter((m) => m.current !== null)
      return {
        year,
        months,
        currentTotal: sumBy(elapsed, (m) => m.current ?? 0),
        previousSamePeriod: sumBy(elapsed, (m) => m.previous),
      }
    }),

  sbSummary: (month) =>
    respond((db) => {
      const aging = emptyBuckets()
      let accounts = 0
      for (const l of db.leases) {
        const a = agingFor(db, l.id)
        if (a.balance <= 0) continue
        for (const k of Object.keys(aging) as AgingBucket[]) aging[k] += a.buckets[k]
        if (a.overdue > 0) accounts++
      }
      const schedule = scheduleOn(db, db.today)
      const rateRows = db.feeRates.filter((r) => r.scheduleId === schedule.id)
      const pick = (market: string, cat: string, kind: string, type: string | null, label: string) => {
        const r = rateRows.find((x) => x.marketId === market && x.sectionCategory === cat && x.kind === kind && (type === null || x.stallType === type))
        return r ? { label, amount: r.amount, ordinanceRef: r.ordinanceRef } : null
      }
      return {
        month,
        collections: db.markets.map((m) => ({ marketId: m.id, amount: monthTotal(db, month, m.id), previousYear: monthTotal(db, addMonthKey(month, -12), m.id) })),
        byType: TYPES.map((t) => ({ type: t, amount: monthTotal(db, month, 'all', { type: t }) })),
        occupancy: db.markets.map((m) => ({ marketId: m.id, ...occupancyOn(db, month === monthKey(db.today) ? db.today : endOfMonth(month), m.id) })),
        aging,
        arrearsAccounts: accounts,
        rates: [
          pick('pm', 'meat', 'monthly_rental', 'standard', 'Public Market · Meat stall, monthly'),
          pick('pm', 'vegetables', 'monthly_rental', 'standard', 'Public Market · Vegetable stall, monthly'),
          pick('pm', 'dry_goods', 'monthly_rental', 'standard', 'Public Market · Dry goods stall, monthly'),
          pick('sm', 'fish', 'monthly_rental', 'standard', 'Seafood Market · Fish stall, monthly'),
          pick('sm', 'fish', 'daily_fee', null, 'Seafood Market · Daily fee per stall'),
          pick('sm', 'transient', 'transient_fee', null, 'Transient seller, small basket'),
        ].filter((x): x is NonNullable<typeof x> => x !== null),
      }
    }),
}

