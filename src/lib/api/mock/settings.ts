import { addDays, nowISO } from '@/lib/dates'
import { formatBps, formatPeso } from '@/lib/money'
import { nextId } from '@/lib/mock/db'
import { ROLE_LABEL } from '@/lib/permissions'
import type { FeeSchedule, Stall, User } from '@/types'
import type { SettingsService } from '../contracts'
import { ctx, stallView } from './derive'
import { ApiError, audit, mutate, requirePermission, required, respond } from './util'

export const settingsService: SettingsService = {
  users: () => respond((db) => db.users),

  inviteUser: (input) =>
    mutate((db) => {
      requirePermission('settings.users')
      if (db.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())) throw new ApiError('A user with this email already exists.')
      const user: User = { id: nextId(db, 'u'), name: input.name.trim(), email: input.email.trim().toLowerCase(), role: input.role, title: input.title.trim(), status: 'invited', lastLoginAt: null, mfaEnabled: input.role === 'treasurer' || input.role === 'admin' }
      db.users.push(user)
      audit(db, { action: 'user.invited', entity: 'User', entityId: user.id, summary: `Invited ${user.name} as ${ROLE_LABEL[user.role]}`, before: null, after: { email: user.email, role: user.role } })
      return user
    }),

  changeRole: (userId, role) =>
    mutate((db) => {
      requirePermission('settings.users')
      const user = required(db.users.find((u) => u.id === userId), 'User')
      const before = user.role
      user.role = role
      user.mfaEnabled = user.mfaEnabled || role === 'treasurer' || role === 'admin'
      audit(db, { action: 'user.role_changed', entity: 'User', entityId: user.id, summary: `Changed ${user.name} from ${ROLE_LABEL[before]} to ${ROLE_LABEL[role]}`, before: { role: before }, after: { role } })
      return user
    }),

  setUserStatus: (userId, status) =>
    mutate((db) => {
      requirePermission('settings.users')
      const user = required(db.users.find((u) => u.id === userId), 'User')
      const before = user.status
      user.status = status
      audit(db, { action: status === 'deactivated' ? 'user.deactivated' : 'user.reactivated', entity: 'User', entityId: user.id, summary: `${status === 'deactivated' ? 'Deactivated' : 'Reactivated'} ${user.name}`, before: { status: before }, after: { status } })
      return user
    }),

  feeSchedules: () => respond((db) => ({ schedules: [...db.feeSchedules].sort((a, b) => b.version - a.version), rates: db.feeRates })),

  createFeeVersion: (input) =>
    mutate((db) => {
      requirePermission('settings.fees')
      const current = [...db.feeSchedules].sort((a, b) => b.version - a.version)[0]!
      if (input.effectiveFrom <= current.effectiveFrom) throw new ApiError('The new version must take effect after the current one.')
      if (!input.ordinanceRef.trim()) throw new ApiError('Cite the ordinance or resolution that approves the new rates.')
      const end = addDays(input.effectiveFrom, -1)
      current.effectiveTo = end
      const next: FeeSchedule = {
        ...current,
        id: `fs-v${current.version + 1}`,
        version: current.version + 1,
        name: `Schedule of market fees (v${current.version + 1})`,
        ordinanceRef: input.ordinanceRef.trim(),
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        penaltyRateBps: input.penaltyRateBps,
        createdAt: nowISO(),
        createdByName: 'Current user',
        notes: input.notes.trim(),
      }
      db.feeSchedules.push(next)
      const changes = new Map(input.changes.map((c) => [c.rateId, c.amount]))
      const changed: string[] = []
      for (const r of db.feeRates.filter((x) => x.scheduleId === current.id)) {
        r.effectiveTo = end
        const amount = changes.get(r.id) ?? r.amount
        if (amount !== r.amount) changed.push(`${r.marketId}/${r.sectionCategory}/${r.stallType ?? r.label ?? 'all'}: ${formatPeso(r.amount)} → ${formatPeso(amount)}`)
        db.feeRates.push({ ...r, id: nextId(db, `fr-v${next.version}`), scheduleId: next.id, amount, ordinanceRef: input.ordinanceRef.trim(), effectiveFrom: input.effectiveFrom, effectiveTo: null })
      }
      audit(db, { action: 'fees.version_created', entity: 'Fee schedule', entityId: next.id, summary: `Created fee schedule v${next.version} effective ${input.effectiveFrom} (${changed.length} rate changes)`, before: { version: current.version, penalty: formatBps(current.penaltyRateBps) }, after: { version: next.version, penalty: formatBps(next.penaltyRateBps), changes: changed.slice(0, 6).join('; ') || 'none' } })
      return next
    }),

  updateSection: (id, input) =>
    mutate((db) => {
      requirePermission('settings.markets')
      const section = required(db.sections.find((s) => s.id === id), 'Section')
      const before = { name: section.name }
      Object.assign(section, input)
      audit(db, { action: 'section.updated', entity: 'Section', entityId: id, summary: `Updated section ${section.name}`, before, after: { name: section.name } })
      return section
    }),

  moveStall: (stallId, gridX, gridY) =>
    mutate((db) => {
      requirePermission('settings.markets')
      const stall = required(ctx(db).stallById.get(stallId), 'Stall')
      const market = required(db.markets.find((m) => m.id === stall.marketId), 'Market')
      if (gridX < 0 || gridY < 0 || gridX >= market.gridCols || gridY >= market.gridRows) throw new ApiError('That position is outside the floor plan.')
      if (db.stalls.some((s) => s.id !== stallId && s.marketId === stall.marketId && s.gridX === gridX && s.gridY === gridY)) throw new ApiError('Another stall already occupies that tile.')
      const before = { gridX: stall.gridX, gridY: stall.gridY }
      stall.gridX = gridX
      stall.gridY = gridY
      audit(db, { action: 'stall.moved', entity: 'Stall', entityId: stall.code, summary: `Moved ${stall.code} on the floor plan`, before, after: { gridX, gridY } })
      return stallView(db, stall)
    }),

  addStall: (input) =>
    mutate((db) => {
      requirePermission('settings.markets')
      const section = required(db.sections.find((s) => s.id === input.sectionId), 'Section')
      if (section.category === 'transient') throw new ApiError("The transient sellers' area has no fixed stalls.")
      if (db.stalls.some((s) => s.marketId === section.marketId && s.gridX === input.gridX && s.gridY === input.gridY)) throw new ApiError('Another stall already occupies that tile.')
      const numbers = db.stalls.filter((s) => s.sectionId === section.id).map((s) => Number(s.code.split('-')[1] ?? 0))
      const code = `${section.codePrefix}-${String(Math.max(0, ...numbers) + 1).padStart(2, '0')}`
      const stall: Stall = { id: `${section.marketId}-${code}`.toLowerCase(), code, marketId: section.marketId, sectionId: section.id, sizeSqm: input.sizeSqm, type: input.type, status: 'vacant', gridX: input.gridX, gridY: input.gridY, currentLeaseId: null, vacantSince: db.today }
      db.stalls.push(stall)
      section.stallCount += 1
      db.stallHistory.push({ id: nextId(db, 'ssh'), stallId: stall.id, from: null, to: 'vacant', at: nowISO(), byName: 'Administrator', note: 'Stall added to the floor plan' })
      audit(db, { action: 'stall.created', entity: 'Stall', entityId: code, summary: `Added stall ${code} to ${section.name}`, before: null, after: { type: input.type, sizeSqm: input.sizeSqm } })
      db.version += 1
      return stallView(db, stall)
    }),

  formTypes: () => respond((db) => db.formTypes),

  updateFormType: (id, input) =>
    mutate((db) => {
      requirePermission('settings.forms')
      const ft = required(db.formTypes.find((f) => f.id === id), 'Form type')
      const before = { name: ft.name, prefix: ft.prefix, serialLength: ft.serialLength }
      Object.assign(ft, input)
      audit(db, { action: 'forms.type_updated', entity: 'Accountable form type', entityId: id, summary: `Updated form type ${ft.shortName}`, before, after: { name: ft.name, prefix: ft.prefix, serialLength: ft.serialLength } })
      return ft
    }),

  sms: () => respond((db) => ({ settings: db.smsSettings, templates: db.smsTemplates })),

  updateSms: (input) =>
    mutate((db) => {
      requirePermission('settings.sms')
      const before = { ...db.smsSettings }
      if (input.yearlyAllowance < 0) throw new ApiError('Allowance cannot be negative.')
      if (!/^[A-Za-z0-9 ]{3,11}$/.test(input.senderName)) throw new ApiError('Sender name must be 3–11 letters or digits.')
      db.smsSettings = { ...input }
      audit(db, { action: 'sms.settings_updated', entity: 'SMS settings', entityId: 'sms', summary: `${input.enabled ? 'Updated' : 'Turned off'} SMS reminders`, before, after: { ...input } })
      return db.smsSettings
    }),

  updateTemplate: (id, input) =>
    mutate((db) => {
      requirePermission('settings.sms')
      const tpl = required(db.smsTemplates.find((t) => t.id === id), 'Template')
      const before = { name: tpl.name, body: tpl.body }
      tpl.name = input.name.trim()
      tpl.body = input.body.trim()
      audit(db, { action: 'sms.template_updated', entity: 'SMS template', entityId: id, summary: `Edited template "${tpl.name}"`, before, after: { name: tpl.name, body: tpl.body } })
      return tpl
    }),

  branding: () => respond((db) => db.branding),

  updateBranding: (input) =>
    mutate((db) => {
      requirePermission('settings.branding')
      const before = { municipality: db.branding.municipality, province: db.branding.province, officeName: db.branding.officeName }
      db.branding = { ...input }
      const pm = db.markets.find((m) => m.id === 'pm')
      const sm = db.markets.find((m) => m.id === 'sm')
      if (pm) pm.name = input.publicMarketName
      if (sm) sm.name = input.seafoodMarketName
      audit(db, { action: 'branding.updated', entity: 'Branding', entityId: 'branding', summary: 'Updated LGU branding', before, after: { municipality: input.municipality, province: input.province, officeName: input.officeName, seal: input.sealDataUrl ? 'uploaded' : 'default' } })
      return db.branding
    }),

  audit: ({ q, action }) =>
    respond((db) => {
      const needle = q?.trim().toLowerCase()
      return db.audit
        .filter((a) => (action && action !== 'all' ? a.action.startsWith(action) : true))
        .filter((a) => (needle ? `${a.actorName} ${a.summary} ${a.entity} ${a.entityId} ${a.action}`.toLowerCase().includes(needle) : true))
    }),

  system: () =>
    respond((db) => ({
      ...db.system,
      devicesOnline: db.devices.filter((d) => d.status === 'active' && d.collectorId && Date.now() - new Date(d.lastSyncAt).getTime() < 2 * 3600_000).length,
      devicesTotal: db.devices.filter((d) => d.status === 'active').length,
    })),
}
