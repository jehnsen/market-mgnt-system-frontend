import type { AuthService, NotificationsService, SearchService } from '../contracts'
import { ctx, countedAmount } from './derive'
import { ApiError, mutate, respond } from './util'

export const notificationsService: NotificationsService = {
  list: () => respond((db) => [...db.notifications].sort((a, b) => (a.at < b.at ? 1 : -1))),
  markRead: (id) =>
    mutate((db) => {
      const n = db.notifications.find((x) => x.id === id)
      if (n) n.read = true
    }),
  markAllRead: () =>
    mutate((db) => {
      for (const n of db.notifications) n.read = true
    }),
}

export const searchService: SearchService = {
  search: (q) =>
    respond((db) => {
      const c = ctx(db)
      const needle = q.trim().toLowerCase()
      if (needle.length < 2) return { stalls: [], lessees: [], collections: [] }
      const digits = needle.replace(/\D/g, '')
      const stalls = db.stalls
        .filter((s) => s.code.toLowerCase().includes(needle) || s.code.toLowerCase().replace('-', '').includes(needle))
        .slice(0, 6)
        .map((s) => {
          const lease = s.currentLeaseId ? c.leaseById.get(s.currentLeaseId) : undefined
          return { id: s.id, code: s.code, marketId: s.marketId, sectionName: c.sectionById.get(s.sectionId)!.name, lesseeName: lease ? (c.lesseeById.get(lease.lesseeId)?.fullName ?? null) : null }
        })
      const lessees = db.lessees
        .filter((l) => `${l.fullName} ${l.businessName ?? ''}`.toLowerCase().includes(needle))
        .slice(0, 6)
        .map((l) => ({ id: l.id, name: l.fullName, stallCodes: (c.leasesByLessee.get(l.id) ?? []).filter((x) => x.status === 'active').map((x) => c.stallById.get(x.stallId)!.code) }))
      const collections =
        digits.length >= 4
          ? db.collections
              .filter((x) => x.receiptSerial.includes(digits) && !x.correctsCollectionId)
              .slice(-6)
              .reverse()
              .map((x) => ({ id: x.id, serial: x.receiptSerial, formType: x.formType, amount: countedAmount(x), date: x.businessDate, collectorName: c.collectorById.get(x.collectorId)?.fullName ?? '—' }))
          : []
      return { stalls, lessees, collections }
    }),
}

export const authService: AuthService = {
  login: ({ email, password }) =>
    respond((db) => {
      const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      if (!user || password.length < 6) throw new ApiError('Incorrect email or password.', 401)
      if (user.status === 'deactivated') throw new ApiError('This account has been deactivated. Contact the Administrator.', 403)
      if (user.status === 'invited') throw new ApiError('Accept your invitation first. Check your email for the link.', 403)
      return { user, needsVerification: user.mfaEnabled }
    }),
  verify: ({ code }) =>
    respond(() => {
      if (!/^\d{6}$/.test(code)) throw new ApiError('Enter the 6-digit code.', 400)
      if (code === '000000') throw new ApiError('That code is not valid. Try again.', 401)
      return { ok: true }
    }),
  requestReset: () => respond(() => undefined),
  demoUsers: () => respond((db) => db.users.filter((u) => u.status === 'active')),
}
