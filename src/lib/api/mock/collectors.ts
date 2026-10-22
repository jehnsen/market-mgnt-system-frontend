import { addDays, daysInMonth, nowISO } from '@/lib/dates'
import { nextId } from '@/lib/mock/db'
import type { CollectorsService } from '../contracts'
import { seriesView } from './accountableForms'
import { collectorView, ctx, inMarket, reconRow } from './derive'
import { ApiError, audit, mutate, requirePermission, required, respond } from './util'

export const collectorsService: CollectorsService = {
  list: (market, date) =>
    respond((db) => db.collectors.filter((c) => inMarket(market, c.marketId)).map((c) => collectorView(db, c, date))),

  get: (id, month) =>
    respond((db) => {
      const c = ctx(db)
      const collector = required(c.collectorById.get(id), 'Collector')
      const dailyTotals = daysInMonth(month)
        .filter((d) => d <= db.today && d >= db.ledgerStart)
        .map((d) => {
          const row = reconRow(db, id, d)
          return { date: d, amount: row.expected, remitted: row.remitted, variance: row.variance, hasRemittance: row.remittances.length > 0 }
        })
      const varianceHistory = []
      for (let d = db.today; d >= db.ledgerStart; d = addDays(d, -1)) {
        const row = reconRow(db, id, d)
        if (row.remittances.length > 0 && row.variance !== 0) varianceHistory.push(row)
      }
      const deviceIds = new Set(db.deviceEvents.filter((e) => e.collectorId === id).map((e) => e.deviceId))
      if (collector.deviceId) deviceIds.add(collector.deviceId)
      return {
        collector: collectorView(db, collector, db.today),
        assignments: db.assignments
          .filter((a) => a.collectorId === id && a.effectiveTo === null)
          .map((a) => ({ ...a, sectionName: c.sectionById.get(a.sectionId)?.name ?? a.sectionId })),
        series: db.formSeries.filter((s) => s.issuedTo === id && (s.status === 'issued' || s.status === 'missing')).map((s) => seriesView(db, s)),
        dailyTotals,
        varianceHistory,
        devices: db.devices.filter((d) => deviceIds.has(d.id)),
        deviceEvents: db.deviceEvents.filter((e) => e.collectorId === id || (collector.deviceId && e.deviceId === collector.deviceId)).sort((a, b) => (a.at < b.at ? 1 : -1)),
      }
    }),

  assignSections: (id, sectionIds) =>
    mutate((db) => {
      requirePermission('collectors.manage')
      const c = ctx(db)
      const collector = required(c.collectorById.get(id), 'Collector')
      if (sectionIds.length === 0) throw new ApiError('Assign at least one section.')
      const sections = sectionIds.map((sid) => required(c.sectionById.get(sid), 'Section'))
      const markets = new Set(sections.map((s) => s.marketId))
      if (markets.size > 1) throw new ApiError('A collector can be assigned to sections in one market only.')
      const before = db.assignments.filter((a) => a.collectorId === id && a.effectiveTo === null).map((a) => a.sectionId)
      for (const a of db.assignments) {
        if (a.effectiveTo !== null) continue
        const mine = a.collectorId === id
        if ((mine && !sectionIds.includes(a.sectionId)) || (!mine && sectionIds.includes(a.sectionId))) a.effectiveTo = db.today
      }
      for (const s of sections) {
        if (!before.includes(s.id)) db.assignments.push({ id: nextId(db, 'asg'), collectorId: id, marketId: s.marketId, sectionId: s.id, effectiveFrom: db.today, effectiveTo: null })
      }
      collector.marketId = sections[0]!.marketId
      audit(db, { action: 'collector.assigned', entity: 'Collector', entityId: collector.code, summary: `Updated section assignments of ${collector.fullName}`, before: { sections: before.join(', ') }, after: { sections: sectionIds.join(', ') } })
      db.version += 1
      return collectorView(db, collector, db.today)
    }),

  suspend: (id, reason) =>
    mutate((db) => {
      requirePermission('collectors.manage')
      const collector = required(ctx(db).collectorById.get(id), 'Collector')
      if (!reason.trim()) throw new ApiError('A reason is required.')
      collector.status = 'suspended'
      collector.suspendedReason = reason.trim()
      audit(db, { action: 'collector.suspended', entity: 'Collector', entityId: collector.code, summary: `Suspended ${collector.fullName}`, before: { status: 'active' }, after: { status: 'suspended', reason: collector.suspendedReason } })
      return collectorView(db, collector, db.today)
    }),

  reinstate: (id) =>
    mutate((db) => {
      requirePermission('collectors.manage')
      const collector = required(ctx(db).collectorById.get(id), 'Collector')
      collector.status = 'active'
      collector.suspendedReason = null
      audit(db, { action: 'collector.reinstated', entity: 'Collector', entityId: collector.code, summary: `Reinstated ${collector.fullName}`, before: { status: 'suspended' }, after: { status: 'active' } })
      return collectorView(db, collector, db.today)
    }),

  deactivateDevice: (deviceId, reason) =>
    mutate((db) => {
      requirePermission('collectors.manage')
      const device = required(db.devices.find((d) => d.id === deviceId), 'Device')
      if (device.status === 'deactivated') throw new ApiError('Device is already deactivated.')
      if (!reason.trim()) throw new ApiError('A reason is required.')
      const collector = device.collectorId ? ctx(db).collectorById.get(device.collectorId) : undefined
      const unsynced = db.collections.filter((c) => c.deviceId === deviceId && !c.synced).length
      device.status = 'deactivated'
      device.deactivatedAt = nowISO()
      device.deactivatedReason = reason.trim()
      if (collector) collector.deviceId = null
      db.deviceEvents.push({ id: nextId(db, 'dve'), deviceId, collectorId: device.collectorId, at: nowISO(), event: 'deactivated', note: `Deactivated: ${reason.trim()}${unsynced ? ` (${unsynced} unsynced entries left on the device)` : ''}` })
      device.collectorId = null
      audit(db, { action: 'device.deactivated', entity: 'Device', entityId: device.label, summary: `Deactivated ${device.label}${collector ? ` (${collector.fullName})` : ''}`, before: { status: 'active', unsynced }, after: { status: 'deactivated', reason: device.deactivatedReason } })
      return device
    }),
}
