import { addDays, addMonthKey, diffDays, endOfMonth, formatDate, formatDayShort, formatWeekday, monthKey, startOfMonth } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import { type Db } from '@/lib/mock/db'
import type { AgingBucket, ISODate, MarketScope, MonthKey } from '@/types'
import type { DashboardAlert, DashboardService, DashboardSummary } from '../contracts'
import { agingFor, collectorView, collectorsWithActivity, ctx, dayTotal, emptyBuckets, inMarket, leaseEnd, leaseView, monthTarget, monthTotal, reconRow } from './derive'
import { respond } from './util'

export function occupancyOn(db: Db, date: ISODate, market: MarketScope) {
  const c = ctx(db)
  const stalls = db.stalls.filter((s) => inMarket(market, s.marketId))
  let occupied = 0
  for (const s of stalls) {
    if ((c.leasesByStall.get(s.id) ?? []).some((l) => l.startDate <= date && leaseEnd(l) >= date && (l.status !== 'expired' || l.endDate >= date))) occupied++
  }
  return { occupied, total: stalls.length }
}

function monthToDate(db: Db, date: ISODate, market: MarketScope) {
  const month = monthKey(date)
  if (date >= endOfMonth(month)) return monthTotal(db, month, market)
  let total = 0
  for (let d = startOfMonth(month) < db.ledgerStart ? db.ledgerStart : startOfMonth(month); d <= date; d = addDays(d, 1)) total += dayTotal(db, d, market)
  if (startOfMonth(month) < db.ledgerStart) total += db.legacyMonthly.filter((r) => r.month === month && inMarket(market, r.marketId)).reduce((s, r) => s + r.amount, 0)
  return total
}

function manilaMinutesNow() {
  const now = new Date()
  return ((now.getUTCHours() + 8) % 24) * 60 + now.getUTCMinutes()
}

export function openVariances(db: Db, market: MarketScope) {
  const rows = []
  for (let d = db.ledgerStart; d < db.today; d = addDays(d, 1)) {
    if (db.dayCloses.get(d)?.closed) continue
    for (const col of collectorsWithActivity(db, d, market)) {
      const row = reconRow(db, col.id, d)
      if (row.remittances.length > 0 && row.variance !== 0) rows.push(row)
    }
  }
  return rows
}

export function buildSummary(db: Db, date: ISODate, market: MarketScope): DashboardSummary {
  const isToday = date === db.today
  const lastWeek = addDays(date, -7)
  const compare = dayTotal(db, lastWeek, market, isToday ? manilaMinutesNow() : undefined)
  const spark: number[] = []
  for (let i = 13; i >= 0; i--) spark.push(dayTotal(db, addDays(date, -i), market))

  const month = monthKey(date)
  const monthSpark: number[] = []
  for (let i = 5; i >= 0; i--) monthSpark.push(monthTotal(db, addMonthKey(month, -i), market))

  const occ = occupancyOn(db, db.today, market)
  const occSpark: number[] = []
  for (let i = 5; i >= 0; i--) {
    const m = addMonthKey(monthKey(db.today), -i)
    const o = occupancyOn(db, i === 0 ? db.today : endOfMonth(m), market)
    occSpark.push(o.total ? Math.round((o.occupied / o.total) * 1000) / 10 : 0)
  }

  const c = ctx(db)
  const aging = emptyBuckets()
  let arrearsAccounts = 0
  for (const l of db.leases) {
    const stall = c.stallById.get(l.stallId)!
    if (!inMarket(market, stall.marketId)) continue
    const a = agingFor(db, l.id)
    if (a.balance <= 0) continue
    for (const k of Object.keys(aging) as AgingBucket[]) aging[k] += a.buckets[k]
    if (a.overdue > 0) arrearsAccounts++
  }

  const variances = openVariances(db, market)

  const byCollector = collectorsWithActivity(db, date, market).map((col) => {
    const row = reconRow(db, col.id, date)
    const view = collectorView(db, col, date)
    return {
      collectorId: col.id,
      collectorName: col.fullName,
      code: col.code,
      sectionNames: view.sectionNames,
      count: row.collectionsCount,
      amount: row.expected,
      lastSyncAt: view.lastSyncAt,
      stale: view.syncStale,
      unsyncedCount: isToday ? view.unsyncedCount : row.pendingSyncCount,
      remitted: row.remitted,
      hasRemittance: row.remittances.length > 0,
      variance: row.variance,
    }
  })

  const sectionTotals = new Map<string, number>()
  for (const col of c.collectionsByDay.get(date) ?? []) {
    if (!inMarket(market, col.marketId)) continue
    const amt = col.correctsCollectionId && col.correctionStatus !== 'approved' ? 0 : col.amount
    sectionTotals.set(col.sectionId, (sectionTotals.get(col.sectionId) ?? 0) + amt)
  }
  const bySection = db.sections
    .filter((s) => inMarket(market, s.marketId))
    .map((s) => ({ sectionId: s.id, name: s.name, marketId: s.marketId, amount: sectionTotals.get(s.id) ?? 0 }))

  const trend = []
  for (let i = 29; i >= 0; i--) {
    const d = addDays(date, -i)
    trend.push({ date: d, amount: dayTotal(db, d, market) })
  }
  const monthly: { month: MonthKey; amount: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const m = addMonthKey(monthKey(db.today), -i)
    monthly.push({ month: m, amount: monthTotal(db, m, market) })
  }

  const expiring = db.leases
    .filter((l) => l.status === 'active' && inMarket(market, c.stallById.get(l.stallId)!.marketId))
    .map((l) => leaseView(db, l))
    .filter((l) => l.daysToExpiry >= 0 && l.daysToExpiry <= 30)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)

  const alerts: DashboardAlert[] = []
  for (const col of db.collectors.filter((x) => inMarket(market, x.marketId))) {
    const v = collectorView(db, col, db.today)
    if (v.syncStale && v.device) {
      alerts.push({ id: `sync-${col.id}`, kind: 'unsynced', severity: 'danger', title: `${v.device.label} (${col.fullName}) has not synced for over 2 hours`, detail: `${v.unsyncedCount} entries are still on the phone. Ask the collector to connect to the internet.`, href: `/app/collectors/${col.id}` })
    }
  }
  const openDays: ISODate[] = []
  for (let d = db.ledgerStart; d < db.today; d = addDays(d, 1)) if (!db.dayCloses.get(d)?.closed) openDays.push(d)
  if (openDays.length) {
    alerts.push({ id: 'unreconciled', kind: 'unreconciled', severity: openDays.length > 2 ? 'danger' : 'warning', title: `${openDays.length} past ${openDays.length === 1 ? 'day is' : 'days are'} not closed`, detail: openDays.map((d) => formatDayShort(d)).join(', '), href: `/app/reconciliation?date=${openDays[0]}` })
  }
  const recentAlerts = db.formAlerts.filter((a) => diffDays(a.date, db.today) <= 30 && a.kind !== 'missing')
  for (const a of recentAlerts) {
    const label = a.kind === 'gap' ? 'Skipped receipt serial' : a.kind === 'duplicate' ? 'Duplicate serial recorded' : 'Serials used out of order'
    alerts.push({ id: a.id, kind: 'serial', severity: 'warning', title: `${label}: ${a.serial}`, detail: `${a.collectorName} · ${formatDate(a.date)}`, href: '/app/accountable-forms' })
  }
  const longVacant = db.stalls.filter((s) => inMarket(market, s.marketId) && s.status === 'vacant' && s.vacantSince && diffDays(s.vacantSince, db.today) > 60)
  if (longVacant.length) {
    alerts.push({ id: 'vacant', kind: 'vacant', severity: 'warning', title: `${longVacant.length} stalls vacant for over 60 days`, detail: longVacant.map((s) => s.code).join(', '), href: '/app/stalls?status=vacant' })
  }

  return {
    date,
    isToday,
    collected: {
      amount: dayTotal(db, date, market),
      compare,
      compareLabel: isToday ? `vs. same time last ${formatWeekday(lastWeek)}` : `vs. ${formatWeekday(lastWeek)}, ${formatDayShort(lastWeek)}`,
      spark,
    },
    month: { amount: monthToDate(db, date, market), target: monthTarget(db, month, market), month, spark: monthSpark },
    occupancy: { occupied: occ.occupied, total: occ.total, rateBps: occ.total ? Math.round((occ.occupied / occ.total) * 10_000) : 0, spark: occSpark },
    arrears: { amount: aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus, accounts: arrearsAccounts },
    variances: { count: variances.length, amount: sumBy(variances, (r) => r.variance) },
    byCollector,
    bySection,
    trend,
    monthly,
    aging,
    expiring,
    alerts,
  }
}

export const dashboardService: DashboardService = {
  summary: (date, market) => respond((db) => buildSummary(db, date, market)),
}
