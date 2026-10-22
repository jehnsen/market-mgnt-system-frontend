import { addDays, formatDate, nowISO } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import type { Collection, CollectionView } from '@/types'
import type { CollectionsService } from '../contracts'
import { collectionView, ctx, inMarket } from './derive'
import { ApiError, audit, currentActor, mutate, notify, requirePermission, required, respond } from './util'

function sortLedger(rows: CollectionView[], byId: Map<string, Collection>): CollectionView[] {
  // Newest day first; inside a day, newest first, with each correction directly under its original.
  const anchor = (c: CollectionView) => (c.correctsCollectionId ? (byId.get(c.correctsCollectionId)?.recordedAt ?? c.recordedAt) : c.recordedAt)
  return rows.sort((a, b) => {
    if (a.businessDate !== b.businessDate) return a.businessDate < b.businessDate ? 1 : -1
    const aa = anchor(a)
    const bb = anchor(b)
    if (aa !== bb) return aa < bb ? 1 : -1
    if (a.correctsCollectionId && !b.correctsCollectionId) return 1
    if (!a.correctsCollectionId && b.correctsCollectionId) return -1
    return a.recordedAt < b.recordedAt ? 1 : -1
  })
}

export const collectionsService: CollectionsService = {
  list: (f) =>
    respond((db) => {
      const c = ctx(db)
      const q = f.q?.trim().toLowerCase()
      const sFrom = f.serialFrom ? Number(f.serialFrom) : null
      const sTo = f.serialTo ? Number(f.serialTo) : null
      const out: CollectionView[] = []
      for (let d = f.from; d <= f.to; d = addDays(d, 1)) {
        for (const col of c.collectionsByDay.get(d) ?? []) {
          if (!inMarket(f.market, col.marketId)) continue
          if (f.collectorId && f.collectorId !== 'all' && col.collectorId !== f.collectorId) continue
          if (f.sectionId && f.sectionId !== 'all' && col.sectionId !== f.sectionId) continue
          if (f.type && f.type !== 'all' && col.type !== f.type) continue
          const serial = Number(col.receiptSerial)
          if (sFrom !== null && serial < sFrom) continue
          if (sTo !== null && serial > sTo) continue
          const v = collectionView(db, col)
          if (f.status && f.status !== 'all') {
            if (f.status === 'correction_pending') {
              const pending = v.correctionStatus === 'pending' || (v.correctedByCollectionId && c.collectionById.get(v.correctedByCollectionId)?.correctionStatus === 'pending')
              if (!pending) continue
            } else if (f.status === 'variance') {
              if (v.status !== 'variance' && !v.isDuplicateSerial) continue
            } else if (v.status !== f.status) continue
          }
          if (q && !`${v.payerName} ${v.stallCode ?? ''} ${v.receiptSerial} ${v.id} ${v.collectorName}`.toLowerCase().includes(q)) continue
          out.push(v)
        }
      }
      return sortLedger(out, c.collectionById)
    }),

  get: (id) =>
    respond((db) => {
      const c = ctx(db)
      const col = required(c.collectionById.get(id), 'Collection')
      const originalId = col.correctsCollectionId ?? col.id
      const linked = [c.collectionById.get(originalId), ...(c.correctionsByOriginal.get(originalId) ?? [])]
        .filter((x): x is Collection => Boolean(x) && x!.id !== id)
        .map((x) => collectionView(db, x))
      return { collection: collectionView(db, col), linked }
    }),

  requestCorrection: (id, input) =>
    mutate((db) => {
      requirePermission('collections.requestCorrection')
      const c = ctx(db)
      const original = required(c.collectionById.get(id), 'Collection')
      if (original.correctsCollectionId) throw new ApiError('A correcting entry cannot itself be corrected. Correct the original entry.')
      const existing = (c.correctionsByOriginal.get(id) ?? []).find((x) => x.correctionStatus !== 'rejected')
      if (existing) throw new ApiError('This entry already has a correction on file.')
      if (db.dayCloses.get(original.businessDate)?.closed) throw new ApiError(`${formatDate(original.businessDate)} is closed. Ask the Treasurer to reopen the day first.`)
      if (!input.reason.trim()) throw new ApiError('A reason is required.')
      const delta = input.correctedAmount - original.amount
      if (delta === 0) throw new ApiError('The corrected amount is the same as the recorded amount.')
      const n = (c.correctionsByOriginal.get(id)?.length ?? 0) + 1
      const now = nowISO()
      const corr: Collection = {
        ...original,
        id: `${original.id}-C${n}`,
        amount: delta,
        recordedAt: now,
        syncedAt: now,
        synced: true,
        status: 'synced',
        correctsCollectionId: original.id,
        correctedByCollectionId: null,
        correctionReason: input.reason.trim(),
        correctionStatus: 'pending',
        correctionRequestedBy: currentActor().name,
        correctionReviewedBy: null,
        correctionReviewedAt: null,
        correctionReviewNote: null,
        remarks: null,
      }
      db.collections.push(corr)
      original.correctedByCollectionId = corr.id
      db.version += 1
      audit(db, { action: 'collection.correction_requested', entity: 'Collection', entityId: original.id, summary: `Requested correction ${formatPeso(original.amount)} → ${formatPeso(input.correctedAmount)}`, before: { amount: formatPeso(original.amount) }, after: { amount: formatPeso(input.correctedAmount), reason: corr.correctionReason } })
      notify(db, { kind: 'variance', title: 'Correction awaiting approval', body: `${currentActor().name} requested a ${formatPeso(delta, { sign: 'always' })} correction on serial ${original.receiptSerial}.`, href: `/app/collections?status=correction_pending&from=${original.businessDate}&to=${original.businessDate}` })
      return collectionView(db, corr)
    }),

  reviewCorrection: (correctionId, input) =>
    mutate((db) => {
      requirePermission('collections.approveCorrection')
      const c = ctx(db)
      const corr = required(c.collectionById.get(correctionId), 'Correction')
      if (!corr.correctsCollectionId || corr.correctionStatus !== 'pending') throw new ApiError('This correction is not awaiting review.')
      if (db.dayCloses.get(corr.businessDate)?.closed) throw new ApiError('The day is closed. Reopen it before reviewing corrections.')
      corr.correctionStatus = input.approve ? 'approved' : 'rejected'
      corr.correctionReviewedBy = currentActor().name
      corr.correctionReviewedAt = nowISO()
      corr.correctionReviewNote = input.note.trim() || null
      const original = c.collectionById.get(corr.correctsCollectionId)
      if (original && !input.approve) original.correctedByCollectionId = null
      audit(db, { action: input.approve ? 'collection.correction_approved' : 'collection.correction_rejected', entity: 'Collection', entityId: corr.correctsCollectionId, summary: `${input.approve ? 'Approved' : 'Rejected'} correction of ${formatPeso(corr.amount, { sign: 'always' })}`, before: { status: 'pending' }, after: { status: corr.correctionStatus, note: corr.correctionReviewNote } })
      return collectionView(db, corr)
    }),

  transientDays: ({ market, from, to }) =>
    respond((db) => {
      const c = ctx(db)
      const out = []
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const list = (c.collectionsByDay.get(d) ?? []).filter((x) => x.type === 'transient_fee' && inMarket(market, x.marketId) && !x.correctsCollectionId)
        out.push({ date: d, vendors: list.length, amount: list.reduce((s, x) => s + x.amount, 0) })
      }
      return out
    }),
}
