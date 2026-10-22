import type {
  AccountableFormSeries,
  Assignment,
  AuditEntry,
  AppNotification,
  BillingRun,
  BrandingSettings,
  Charge,
  Collection,
  Collector,
  DayClose,
  DemandNotice,
  Device,
  DeviceEvent,
  FeeRate,
  FeeSchedule,
  FormAlert,
  FormTypeConfig,
  ISODate,
  Lease,
  LegacyMonthly,
  Lessee,
  Market,
  Payment,
  ReconRecord,
  Remittance,
  Section,
  SmsMessage,
  SmsSettings,
  SmsTemplate,
  Stall,
  StallDocument,
  StallStatusChange,
  SystemStatus,
  User,
} from '@/types'
import { createSeed } from './seed'

export interface Db {
  today: ISODate
  markets: Market[]
  sections: Section[]
  stalls: Stall[]
  stallHistory: StallStatusChange[]
  documents: StallDocument[]
  lessees: Lessee[]
  leases: Lease[]
  feeSchedules: FeeSchedule[]
  feeRates: FeeRate[]
  collectors: Collector[]
  devices: Device[]
  deviceEvents: DeviceEvent[]
  assignments: Assignment[]
  collections: Collection[]
  /** First day with collection records; earlier months come from legacyMonthly. */
  ledgerStart: ISODate
  legacyMonthly: LegacyMonthly[]
  remittances: Remittance[]
  recon: Map<string, ReconRecord>
  dayCloses: Map<ISODate, DayClose>
  formSeries: AccountableFormSeries[]
  formAlerts: FormAlert[]
  formTypes: FormTypeConfig[]
  charges: Charge[]
  payments: Payment[]
  billingRuns: BillingRun[]
  notices: DemandNotice[]
  smsTemplates: SmsTemplate[]
  smsMessages: SmsMessage[]
  smsSettings: SmsSettings
  users: User[]
  audit: AuditEntry[]
  notifications: AppNotification[]
  branding: BrandingSettings
  system: SystemStatus
  counters: Record<string, number>
  /** Bumped on every mutation; used to invalidate derived caches. */
  version: number
}

let instance: Db | null = null

export function getDb(): Db {
  if (!instance) instance = createSeed(new Date())
  return instance
}

export function resetDb(): void {
  instance = null
}

export function reconKey(collectorId: string, date: ISODate): string {
  return `${collectorId}|${date}`
}

export function nextId(db: Db, prefix: string): string {
  db.counters[prefix] = (db.counters[prefix] ?? 0) + 1
  return `${prefix}-${String(db.counters[prefix]).padStart(5, '0')}`
}

/** Cached id → item lookup that refreshes when the array grows. */
const indexCache = new WeakMap<object, { len: number; map: Map<string, unknown> }>()

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  const hit = indexCache.get(items)
  if (hit && hit.len === items.length) return hit.map as Map<string, T>
  const map = new Map<string, T>()
  for (const item of items) map.set(item.id, item)
  indexCache.set(items, { len: items.length, map })
  return map
}
