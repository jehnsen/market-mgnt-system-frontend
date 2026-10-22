import { daysInMonth, formatDate, nowISO } from '@/lib/dates'
import { formatPeso, sumBy } from '@/lib/money'
import { type Db, nextId, reconKey } from '@/lib/mock/db'
import type { CollectionType, DayClose, ISODate, ReconCalendarDay, ReconRecord } from '@/types'
import type { ReconciliationService } from '../contracts'
import { collectionView, collectorView, collectorsWithActivity, ctx, reconRow } from './derive'
import { ApiError, audit, currentActor, mutate, notify, requirePermission, required, respond } from './util'

function dayClose(db: Db, date: ISODate): DayClose {
  let dc = db.dayCloses.get(date)
  if (!dc) {
    dc = { date, closed: false, closedByName: null, closedAt: null, reopenings: [] }
    db.dayCloses.set(date, dc)
  }
  return dc
}

function record(db: Db, collectorId: string, date: ISODate): ReconRecord {
  const key = reconKey(collectorId, date)
  let r = db.recon.get(key)
  if (!r) {
    r = { collectorId, date, status: 'open', statusBeforeClose: null, flagReason: null, markedByName: null, markedAt: null, notes: '' }
    db.recon.set(key, r)
  }
  return r
}

/** Reasons a day cannot be closed yet. Closing is municipality-wide, so every market is checked. */
function closeBlockers(db: Db, date: ISODate): string[] {
  const out: string[] = []
  if (date >= db.today) out.push('A day can be closed only after collection hours have ended (from the next day).')
  const rows = collectorsWithActivity(db, date, 'all').map((c) => reconRow(db, c.id, date))
  const pendingSync = rows.filter((r) => r.pendingSyncCount > 0)
  if (pendingSync.length) out.push(`${pendingSync.map((r) => r.collectorName).join(', ')} still ${pendingSync.length === 1 ? 'has' : 'have'} unsynced entries.`)
  const noRemit = rows.filter((r) => r.remittances.length === 0 && r.expected !== 0)
  if (noRemit.length) out.push(`No remittance recorded for ${noRemit.map((r) => r.collectorName).join(', ')}.`)
  const open = rows.filter((r) => r.status === 'open' && r.remittances.length > 0)
  if (open.length) out.push(`${open.length} collector ${open.length === 1 ? 'row is' : 'rows are'} not yet marked balanced or flagged.`)
  const pendingCorr = ctx(db).collectionsByDay.get(date)?.filter((c) => c.correctionStatus === 'pending') ?? []
  if (pendingCorr.length) out.push(`${pendingCorr.length} correction${pendingCorr.length === 1 ? '' : 's'} awaiting the Treasurer's decision.`)
  return out
}

function assertOpen(db: Db, date: ISODate) {
  if (db.dayCloses.get(date)?.closed) throw new ApiError(`${formatDate(date)} is closed. Reopen it to make changes.`)
}

export const reconciliationService: ReconciliationService = {
  day: (date, market) =>
    respond((db) => {
      const rows = collectorsWithActivity(db, date, market).map((c) => reconRow(db, c.id, date))
      const dc = db.dayCloses.get(date) ?? { date, closed: false, closedByName: null, closedAt: null, reopenings: [] }
      const blockers = dc.closed ? [] : closeBlockers(db, date)
      return { date, rows, dayClose: dc, canClose: !dc.closed && blockers.length === 0, closeBlockers: blockers }
    }),

  calendar: (month, market) =>
    respond((db) =>
      daysInMonth(month).map((date): ReconCalendarDay => {
        if (date > db.today || date < db.ledgerStart) return { date, state: 'future', closed: false, variance: 0 }
        const rows = collectorsWithActivity(db, date, market).map((c) => reconRow(db, c.id, date))
        const variance = sumBy(rows.filter((r) => r.remittances.length > 0), (r) => r.variance)
        const closed = db.dayCloses.get(date)?.closed ?? false
        const hasVariance = rows.some((r) => r.remittances.length > 0 && r.variance !== 0)
        return { date, closed, variance, state: hasVariance ? 'variance' : closed ? 'closed' : 'open' }
      }),
    ),

  recordRemittance: (input) =>
    mutate((db) => {
      requirePermission('recon.recordRemittance')
      assertOpen(db, input.date)
      if (input.amount <= 0) throw new ApiError('Remittance amount must be greater than zero.')
      if (!input.reference.trim()) throw new ApiError('Enter the deposit or RCD reference.')
      required(ctx(db).collectorById.get(input.collectorId), 'Collector')
      db.remittances.push({
        id: nextId(db, 'rem'),
        collectorId: input.collectorId,
        businessDate: input.date,
        amount: input.amount,
        reference: input.reference.trim(),
        receivedByName: currentActor().name,
        receivedAt: nowISO(),
        notes: input.notes.trim(),
      })
      const r = record(db, input.collectorId, input.date)
      if (r.status !== 'open') {
        r.status = 'open'
        r.flagReason = null
      }
      audit(db, { action: 'remittance.recorded', entity: 'Remittance', entityId: input.reference.trim(), summary: `Recorded remittance of ${formatPeso(input.amount)} for ${formatDate(input.date)}`, before: null, after: { amount: formatPeso(input.amount), collectorId: input.collectorId } })
      // Return a row computed after the store version bump.
      db.version += 1
      return reconRow(db, input.collectorId, input.date)
    }),

  markBalanced: (collectorId, date) =>
    mutate((db) => {
      requirePermission('recon.mark')
      assertOpen(db, date)
      const row = reconRow(db, collectorId, date)
      if (row.remittances.length === 0) throw new ApiError('Record the remittance first.')
      if (row.pendingSyncCount > 0) throw new ApiError('Some entries are still on the collector’s phone. Wait for the device to sync.')
      if (row.variance !== 0) throw new ApiError('Variance is not zero. Flag the shortage or overage instead.')
      const r = record(db, collectorId, date)
      r.status = 'balanced'
      r.flagReason = null
      r.markedByName = currentActor().name
      r.markedAt = nowISO()
      audit(db, { action: 'recon.balanced', entity: 'Reconciliation', entityId: `${row.collectorName} · ${date}`, summary: `Marked ${row.collectorName} balanced for ${formatDate(date)}`, before: { status: 'open' }, after: { status: 'balanced' } })
      return { ...row, status: 'balanced' as const, markedByName: r.markedByName }
    }),

  flagVariance: (collectorId, date, reason) =>
    mutate((db) => {
      requirePermission('recon.mark')
      assertOpen(db, date)
      const row = reconRow(db, collectorId, date)
      if (row.remittances.length === 0) throw new ApiError('Record the remittance first.')
      if (row.variance === 0) throw new ApiError('There is no variance to flag.')
      if (!reason.trim()) throw new ApiError('An explanation is required.')
      const r = record(db, collectorId, date)
      r.status = row.variance < 0 ? 'shortage' : 'overage'
      r.flagReason = reason.trim()
      r.markedByName = currentActor().name
      r.markedAt = nowISO()
      audit(db, { action: `recon.${r.status}`, entity: 'Reconciliation', entityId: `${row.collectorName} · ${date}`, summary: `Flagged ${r.status} of ${formatPeso(row.variance)} for ${row.collectorName}`, before: { status: 'open' }, after: { status: r.status, reason: r.flagReason } })
      notify(db, { kind: 'variance', title: `${r.status === 'shortage' ? 'Shortage' : 'Overage'} flagged`, body: `${row.collectorName}: ${formatPeso(row.variance, { sign: 'always' })} on ${formatDate(date)}.`, href: `/app/reconciliation?date=${date}` })
      return { ...row, status: r.status, flagReason: r.flagReason }
    }),

  closeDay: (date) =>
    mutate((db) => {
      requirePermission('recon.closeDay')
      const dc = dayClose(db, date)
      if (dc.closed) throw new ApiError('This day is already closed.')
      const blockers = closeBlockers(db, date)
      if (blockers.length) throw new ApiError(blockers[0]!)
      for (const col of collectorsWithActivity(db, date, 'all')) {
        const r = record(db, col.id, date)
        if (r.status !== 'closed') r.statusBeforeClose = r.status
        r.status = 'closed'
      }
      dc.closed = true
      dc.closedByName = currentActor().name
      dc.closedAt = nowISO()
      audit(db, { action: 'day.closed', entity: 'Collection day', entityId: date, summary: `Closed collection day ${formatDate(date)}`, before: { status: 'open' }, after: { status: 'closed' } })
      return dc
    }),

  reopenDay: (date, reason) =>
    mutate((db) => {
      requirePermission('recon.closeDay')
      const dc = dayClose(db, date)
      if (!dc.closed) throw new ApiError('This day is not closed.')
      if (reason.trim().length < 10) throw new ApiError('Give a reason of at least 10 characters. Reopening is audited.')
      for (const col of collectorsWithActivity(db, date, 'all')) {
        const r = record(db, col.id, date)
        if (r.status === 'closed') r.status = r.statusBeforeClose ?? 'open'
      }
      dc.closed = false
      dc.reopenings.push({ at: nowISO(), byName: currentActor().name, reason: reason.trim() })
      audit(db, { action: 'day.reopened', entity: 'Collection day', entityId: date, summary: `Reopened ${formatDate(date)}`, before: { status: 'closed' }, after: { status: 'open', reason: reason.trim() } })
      return dc
    }),

  reportOfCollections: (collectorId, date) =>
    respond((db) => {
      const c = ctx(db)
      const collector = required(c.collectorById.get(collectorId), 'Collector')
      const row = reconRow(db, collectorId, date)
      const items = (c.collectionsByCollectorDay.get(reconKey(collectorId, date)) ?? []).map((x) => collectionView(db, x))
      const types: CollectionType[] = ['daily_fee', 'monthly_rental', 'transient_fee', 'penalty', 'other']
      const byType = types
        .map((type) => {
          const list = items.filter((x) => x.type === type)
          return { type, count: list.filter((x) => !x.correctsCollectionId).length, amount: sumBy(list, (x) => x.countedAmount) }
        })
        .filter((x) => x.count > 0 || x.amount !== 0)
      return {
        row,
        collector: collectorView(db, collector, date),
        byType,
        collections: items.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1)),
      }
    }),
}
