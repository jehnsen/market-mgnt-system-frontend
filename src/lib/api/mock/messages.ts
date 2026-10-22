import { diffDays, endOfMonth, formatDate, formatMonth, monthKey, nowISO } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import { type Db, nextId } from '@/lib/mock/db'
import { renderTemplate, smsUnits } from '@/lib/sms'
import type { Lessee, SmsMessage } from '@/types'
import type { MessagesService, Recipient, SmsUsage } from '../contracts'
import { agingFor, ctx, inMarket } from './derive'
import { ApiError, audit, mutate, notify, requirePermission, required, respond } from './util'

function usage(db: Db): SmsUsage {
  const year = Number(db.today.slice(0, 4))
  const month = monthKey(db.today)
  let used = 0
  let sentThisMonth = 0
  let failedThisMonth = 0
  for (const m of db.smsMessages) {
    if (!m.createdAt.startsWith(String(year))) continue
    if (m.status !== 'failed') used += m.costUnits
    if (m.createdAt.startsWith(month)) {
      if (m.status === 'sent') sentThisMonth++
      if (m.status === 'failed') failedThisMonth++
    }
  }
  return { year, used, allowance: db.smsSettings.yearlyAllowance, warnAtPercent: db.smsSettings.warnAtPercent, sentThisMonth, failedThisMonth }
}

function toRecipient(db: Db, l: Lessee): Recipient {
  const c = ctx(db)
  const leases = (c.leasesByLessee.get(l.id) ?? []).filter((x) => x.status === 'active')
  const stalls = leases.map((x) => c.stallById.get(x.stallId)!)
  let balance = 0
  for (const lease of c.leasesByLessee.get(l.id) ?? []) balance += agingFor(db, lease.id).balance
  const leaseEnd = leases.map((x) => x.endDate).sort()[0] ?? null
  return {
    lesseeId: l.id,
    name: l.fullName,
    phone: l.contactNumber,
    stallCodes: stalls.map((s) => s.code),
    marketId: stalls[0]?.marketId ?? 'pm',
    balance,
    leaseEnd,
    monthlyRate: leases.reduce((s, x) => s + x.monthlyRate, 0),
  }
}

export const messagesService: MessagesService = {
  templates: () => respond((db) => db.smsTemplates),

  log: (f) =>
    respond((db) => {
      const q = f.q?.trim().toLowerCase()
      return db.smsMessages
        .filter((m) => (f.status && f.status !== 'all' ? m.status === f.status : true))
        .filter((m) => (f.templateId && f.templateId !== 'all' ? m.templateId === f.templateId : true))
        .filter((m) => (q ? `${m.recipientName} ${m.phone} ${m.body}`.toLowerCase().includes(q) : true))
    }),

  usage: () => respond((db) => usage(db)),

  recipients: ({ group, market, sectionId, lesseeIds }) =>
    respond((db) => {
      const c = ctx(db)
      let pool: Lessee[] = []
      if (group === 'selected') {
        pool = (lesseeIds ?? []).map((id) => c.lesseeById.get(id)).filter((x): x is Lessee => Boolean(x))
      } else {
        const ids = new Set<string>()
        for (const lease of db.leases) {
          const stall = c.stallById.get(lease.stallId)!
          if (!inMarket(market, stall.marketId)) continue
          if (group === 'overdue') {
            if (agingFor(db, lease.id).overdue > 0) ids.add(lease.lesseeId)
          } else if (lease.status === 'active') {
            if (group === 'expiring' && diffDays(db.today, lease.endDate) <= 30) ids.add(lease.lesseeId)
            if (group === 'section' && stall.sectionId === sectionId) ids.add(lease.lesseeId)
          }
        }
        pool = [...ids].map((id) => c.lesseeById.get(id)!).sort((a, b) => a.lastName.localeCompare(b.lastName))
      }
      return {
        eligible: pool.filter((l) => l.smsConsent).map((l) => toRecipient(db, l)),
        excludedNoConsent: pool.filter((l) => !l.smsConsent).length,
      }
    }),

  send: ({ templateId, lesseeIds, scheduleAt }) =>
    mutate((db) => {
      requirePermission('messages.send')
      if (!db.smsSettings.enabled) throw new ApiError('SMS reminders are turned off in Settings.')
      const tpl = required(db.smsTemplates.find((t) => t.id === templateId), 'Template')
      const c = ctx(db)
      const recipients = lesseeIds
        .map((id) => c.lesseeById.get(id))
        .filter((l): l is Lessee => Boolean(l) && l!.smsConsent)
      if (recipients.length === 0) throw new ApiError('No recipients with SMS consent were selected.')
      const now = nowISO()
      const batchId = nextId(db, 'batch')
      const drafts: SmsMessage[] = recipients.map((l) => {
        const r = toRecipient(db, l)
        const body = renderTemplate(tpl.body, {
          name: l.fullName,
          stall: r.stallCodes.join(', ') || '—',
          market: r.marketId === 'sm' ? 'Seafood Market' : 'Public Market',
          balance: formatPeso(r.balance),
          amount: formatPeso(r.monthlyRate),
          month: formatMonth(monthKey(db.today)),
          due_date: formatDate(endOfMonth(monthKey(db.today))),
          lease_end: formatDate(r.leaseEnd),
          as_of: formatDate(db.today),
        })
        const failed = !scheduleAt && Math.random() < 0.03
        return {
          id: nextId(db, 'sms'),
          batchId,
          lesseeId: l.id,
          recipientName: l.fullName,
          phone: l.contactNumber,
          templateId: tpl.id,
          templateName: tpl.name,
          body,
          status: scheduleAt ? 'queued' : failed ? 'failed' : 'sent',
          createdAt: now,
          sentAt: scheduleAt ? null : now,
          scheduledFor: scheduleAt,
          costUnits: failed ? 0 : smsUnits(body),
          failureReason: failed ? 'Number unreachable' : null,
        }
      })
      const units = drafts.reduce((s, m) => s + m.costUnits, 0)
      const u = usage(db)
      if (u.used + units > u.allowance) throw new ApiError(`This batch needs ${units} units but only ${u.allowance - u.used} remain in this year's allowance.`)
      db.smsMessages.unshift(...drafts)
      audit(db, { action: scheduleAt ? 'sms.scheduled' : 'sms.sent', entity: 'SMS batch', entityId: batchId, summary: `${scheduleAt ? 'Scheduled' : 'Sent'} "${tpl.name}" to ${drafts.length} lessee(s)`, before: null, after: { units, scheduledFor: scheduleAt } })
      const failures = drafts.filter((m) => m.status === 'failed').length
      if (failures) notify(db, { kind: 'sms_failed', title: `${failures} SMS failed to send`, body: `From the "${tpl.name}" batch just sent.`, href: '/app/messages?status=failed' })
      return { queued: drafts.length, units }
    }),

  settings: () => respond((db) => db.smsSettings),
}
