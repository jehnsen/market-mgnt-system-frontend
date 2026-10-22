import { endOfMonth, formatDate, startOfMonth } from '@/lib/dates'
import { type Db, nextId } from '@/lib/mock/db'
import type { AccountableFormSeries, AccountableFormSeriesView } from '@/types'
import type { AccountableFormsService, AccountabilitySummary } from '../contracts'
import { collectorView, ctx } from './derive'
import { ApiError, audit, currentActor, mutate, requirePermission, required, respond } from './util'

const STATUS_ORDER: Record<AccountableFormSeries['status'], number> = { issued: 0, missing: 1, in_stock: 2, returned: 3, exhausted: 4 }

export function seriesView(db: Db, s: AccountableFormSeries): AccountableFormSeriesView {
  const size = s.end - s.start + 1
  const unused = s.end - (s.lastUsed ?? s.start - 1)
  let remaining = 0
  if (s.status === 'issued') remaining = unused - s.missingSerials.filter((n) => n > (s.lastUsed ?? 0)).length
  else if (s.status === 'in_stock') remaining = size
  return {
    ...s,
    issuedToName: s.issuedTo ? (ctx(db).collectorById.get(s.issuedTo)?.fullName ?? null) : null,
    remaining,
  }
}

const pad = (db: Db, formType: string, n: number) => String(n).padStart(db.formTypes.find((f) => f.id === formType)?.serialLength ?? 7, '0')

export const accountableFormsService: AccountableFormsService = {
  formTypes: () => respond((db) => db.formTypes),

  series: (f) =>
    respond((db) =>
      db.formSeries
        .filter((s) => (f.formType && f.formType !== 'all' ? s.formType === f.formType : true))
        .filter((s) => (f.collectorId && f.collectorId !== 'all' ? s.issuedTo === f.collectorId : true))
        .filter((s) => (f.status && f.status !== 'all' ? s.status === f.status : true))
        .map((s) => seriesView(db, s))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.issuedOn ?? '').localeCompare(a.issuedOn ?? '') || a.start - b.start),
    ),

  alerts: () => respond((db) => [...db.formAlerts].sort((a, b) => (a.date < b.date ? 1 : -1))),

  issue: (input) =>
    mutate((db) => {
      requirePermission('forms.manage')
      if (input.end < input.start) throw new ApiError('The last serial must not be lower than the first serial.')
      if (input.end - input.start + 1 > 5000) throw new ApiError('Issue at most 5,000 forms at a time.')
      const collector = required(ctx(db).collectorById.get(input.collectorId), 'Collector')
      const stock = db.formSeries.find((s) => s.status === 'in_stock' && s.formType === input.formType && s.start === input.start && s.end === input.end)
      let series: AccountableFormSeries
      if (stock) {
        series = stock
      } else {
        const overlap = db.formSeries.find((s) => s.formType === input.formType && s.start <= input.end && s.end >= input.start)
        if (overlap) throw new ApiError(`Serials overlap an existing series (${pad(db, overlap.formType, overlap.start)}–${pad(db, overlap.formType, overlap.end)}).`)
        series = { id: nextId(db, 'afs'), formType: input.formType, start: input.start, end: input.end, issuedTo: null, issuedOn: null, issuedByName: null, lastUsed: null, usedCount: 0, status: 'in_stock', returnedOn: null, missingReason: null, missingSerials: [] }
        db.formSeries.push(series)
      }
      series.status = 'issued'
      series.issuedTo = collector.id
      series.issuedOn = input.issuedOn
      series.issuedByName = currentActor().name
      audit(db, { action: 'forms.issued', entity: 'Accountable form series', entityId: series.id, summary: `Issued ${pad(db, series.formType, series.start)}–${pad(db, series.formType, series.end)} to ${collector.fullName}`, before: null, after: { start: series.start, end: series.end, collector: collector.fullName } })
      return seriesView(db, series)
    }),

  returnUnused: (id) =>
    mutate((db) => {
      requirePermission('forms.manage')
      const s = required(db.formSeries.find((x) => x.id === id), 'Series')
      if (s.status !== 'issued') throw new ApiError('Only an issued series can be returned.')
      s.status = 'returned'
      s.returnedOn = db.today
      audit(db, { action: 'forms.returned', entity: 'Accountable form series', entityId: id, summary: `Returned unused forms ${pad(db, s.formType, (s.lastUsed ?? s.start - 1) + 1)}–${pad(db, s.formType, s.end)}`, before: { status: 'issued' }, after: { status: 'returned' } })
      return seriesView(db, s)
    }),

  reportMissing: (id, input) =>
    mutate((db) => {
      requirePermission('forms.manage')
      const s = required(db.formSeries.find((x) => x.id === id), 'Series')
      if (input.from < s.start || input.to > s.end || input.to < input.from) throw new ApiError('The missing range must fall inside the series.')
      if (!input.reason.trim()) throw new ApiError('A reason is required.')
      const missing = new Set(s.missingSerials)
      for (let n = input.from; n <= input.to; n++) missing.add(n)
      s.missingSerials = [...missing].sort((a, b) => a - b)
      s.missingReason = input.reason.trim()
      if (input.from <= (s.lastUsed ?? s.start - 1) + 1 && input.to === s.end) s.status = 'missing'
      db.formAlerts.unshift({
        id: nextId(db, 'fal'),
        kind: 'missing',
        collectorId: s.issuedTo ?? '',
        collectorName: s.issuedTo ? (ctx(db).collectorById.get(s.issuedTo)?.fullName ?? '') : 'Treasury stock',
        formType: s.formType,
        serial: input.from === input.to ? pad(db, s.formType, input.from) : `${pad(db, s.formType, input.from)}–${pad(db, s.formType, input.to)}`,
        date: db.today,
        note: input.reason.trim(),
      })
      audit(db, { action: 'forms.missing', entity: 'Accountable form series', entityId: id, summary: `Reported ${input.to - input.from + 1} form(s) missing`, before: null, after: { from: input.from, to: input.to, reason: s.missingReason } })
      return seriesView(db, s)
    }),

  summary: (collectorId, month) =>
    respond((db): AccountabilitySummary => {
      const c = ctx(db)
      const collector = required(c.collectorById.get(collectorId), 'Collector')
      const from = startOfMonth(month)
      const to = endOfMonth(month)
      const mine = db.collections.filter((x) => x.collectorId === collectorId && !x.correctsCollectionId)
      const rows: AccountabilitySummary['rows'] = []
      for (const s of db.formSeries.filter((x) => x.issuedTo === collectorId && x.issuedOn && x.issuedOn <= to)) {
        const inSeries = mine.filter((x) => x.formType === s.formType && Number(x.receiptSerial) >= s.start && Number(x.receiptSerial) <= s.end)
        const usedBefore = inSeries.filter((x) => x.businessDate < from).map((x) => Number(x.receiptSerial))
        const usedIn = inSeries.filter((x) => x.businessDate >= from && x.businessDate <= to).map((x) => Number(x.receiptSerial))
        const lastBefore = usedBefore.length ? Math.max(...usedBefore) : s.start - 1
        if (lastBefore >= s.end) continue
        const lastIn = usedIn.length ? Math.max(...usedIn) : lastBefore
        const issuedBeforeMonth = s.issuedOn! < from
        if (s.returnedOn && s.returnedOn < from) continue
        const r = (a: number, b: number) => ({ from: pad(db, s.formType, a), to: pad(db, s.formType, b), qty: b - a + 1 })
        rows.push({
          formType: s.formType,
          formName: db.formTypes.find((f) => f.id === s.formType)?.name ?? s.formType,
          beginning: issuedBeforeMonth ? r(lastBefore + 1, s.end) : null,
          received: issuedBeforeMonth ? [] : [r(s.start, s.end)],
          issued: usedIn.length ? { ...r(Math.min(...usedIn), lastIn), qty: usedIn.length } : null,
          ending: lastIn < s.end && s.status !== 'missing' && s.status !== 'returned' ? r(lastIn + 1, s.end) : null,
        })
      }
      return {
        collector: collectorView(db, collector, db.today),
        month,
        rows: rows.sort((a, b) =>
          a.formType === b.formType
            ? (a.beginning?.from ?? a.received[0]?.from ?? '').localeCompare(b.beginning?.from ?? b.received[0]?.from ?? '')
            : a.formType < b.formType
              ? 1
              : -1,
        ),
        alerts: db.formAlerts.filter((a) => a.collectorId === collectorId && a.date >= from && a.date <= to),
      }
    }),
}

export function describeSeries(db: Db, s: AccountableFormSeries) {
  return `${pad(db, s.formType, s.start)}–${pad(db, s.formType, s.end)} (${formatDate(s.issuedOn)})`
}
