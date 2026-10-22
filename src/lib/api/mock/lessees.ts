import type { LesseesService } from '../contracts'
import { ctx, inMarket, leaseView, lesseeView, statementFor } from './derive'
import { createLessee } from './leases'
import { noticeView } from './billing'
import { audit, mutate, requirePermission, required, respond } from './util'

export const lesseesService: LesseesService = {
  list: (f) =>
    respond((db) => {
      const c = ctx(db)
      const q = f.q?.trim().toLowerCase()
      return db.lessees
        .map((l) => lesseeView(db, l))
        .filter((l) => {
          if (f.market === 'all') return true
          const leases = c.leasesByLessee.get(l.id) ?? []
          return leases.some((x) => inMarket(f.market, c.stallById.get(x.stallId)!.marketId))
        })
        .filter((l) => (f.withBalance ? l.balance > 0 : true))
        .filter((l) =>
          q ? `${l.fullName} ${l.businessName ?? ''} ${l.stallCodes.join(' ')}`.toLowerCase().includes(q) : true,
        )
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    }),

  get: (id) =>
    respond((db) => {
      const c = ctx(db)
      const lessee = required(c.lesseeById.get(id), 'Lessee')
      return {
        lessee: lesseeView(db, lessee),
        leases: (c.leasesByLessee.get(id) ?? []).map((l) => leaseView(db, l)).sort((a, b) => (a.startDate < b.startDate ? 1 : -1)),
        statement: statementFor(db, id, db.today),
        notices: db.notices.filter((n) => n.lesseeId === id).map((n) => noticeView(db, n)).reverse(),
        sms: db.smsMessages.filter((m) => m.lesseeId === id),
        documents: db.documents.filter((d) => d.lesseeId === id),
      }
    }),

  create: (input) =>
    mutate((db) => {
      requirePermission('lessees.manage')
      return createLessee(db, input)
    }),

  update: (id, input) =>
    mutate((db) => {
      requirePermission('lessees.manage')
      const lessee = required(ctx(db).lesseeById.get(id), 'Lessee')
      const before = { contactNumber: lessee.contactNumber, smsConsent: lessee.smsConsent, address: lessee.address }
      lessee.firstName = input.firstName.trim()
      lessee.middleInitial = input.middleInitial.trim().replace('.', '')
      lessee.lastName = input.lastName.trim()
      lessee.fullName = `${lessee.firstName}${lessee.middleInitial ? ` ${lessee.middleInitial}.` : ''} ${lessee.lastName}`
      lessee.businessName = input.businessName.trim() || null
      lessee.contactNumber = input.contactNumber.trim()
      lessee.email = input.email.trim() || null
      lessee.address = input.address.trim()
      if (input.smsConsent !== lessee.smsConsent) lessee.smsConsentAt = input.smsConsent ? new Date().toISOString() : null
      lessee.smsConsent = input.smsConsent
      lessee.notes = input.notes.trim() || null
      audit(db, { action: 'lessee.updated', entity: 'Lessee', entityId: id, summary: `Updated ${lessee.fullName}`, before, after: { contactNumber: lessee.contactNumber, smsConsent: lessee.smsConsent, address: lessee.address } })
      return lessee
    }),
}
