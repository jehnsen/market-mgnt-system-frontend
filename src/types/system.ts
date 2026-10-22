import type { ISODate, ISODateTime } from './common'

export type Role =
  | 'treasurer'
  | 'treasury_staff'
  | 'market_supervisor'
  | 'mayor'
  | 'sb'
  | 'admin'

export type UserStatus = 'active' | 'invited' | 'deactivated'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  title: string
  status: UserStatus
  lastLoginAt: ISODateTime | null
  mfaEnabled: boolean
}

export type AuditValue = string | number | boolean | null

export interface AuditEntry {
  id: string
  at: ISODateTime
  actorName: string
  actorRole: Role | 'system' | 'device'
  action: string
  entity: string
  entityId: string
  summary: string
  before: Record<string, AuditValue> | null
  after: Record<string, AuditValue> | null
}

export type NotificationKind =
  | 'variance'
  | 'device_unsynced'
  | 'day_not_closed'
  | 'lease_expiring'
  | 'billing_complete'
  | 'sms_failed'
  | 'serial_gap'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  at: ISODateTime
  read: boolean
  href: string
}

export type SmsStatus = 'queued' | 'sent' | 'failed'

export type SmsPurpose = 'overdue' | 'expiring' | 'billing' | 'advisory'

export interface SmsTemplate {
  id: string
  name: string
  purpose: SmsPurpose
  body: string
}

export interface SmsMessage {
  id: string
  batchId: string
  lesseeId: string
  recipientName: string
  phone: string
  templateId: string
  templateName: string
  body: string
  status: SmsStatus
  createdAt: ISODateTime
  sentAt: ISODateTime | null
  scheduledFor: ISODateTime | null
  costUnits: number
  failureReason: string | null
}

export interface SmsSettings {
  enabled: boolean
  senderName: string
  yearlyAllowance: number
  warnAtPercent: number
}

export interface BrandingSettings {
  municipality: string
  province: string
  officeName: string
  publicMarketName: string
  seafoodMarketName: string
  sealDataUrl: string | null
}

export interface SystemStatus {
  lastBackupAt: ISODateTime
  backupStatus: 'ok' | 'warning'
  storageUsedMb: number
  storageQuotaMb: number
  devicesOnline: number
  devicesTotal: number
  apiVersion: string
  appVersion: string
}

export interface FormTypeConfig {
  id: string
  name: string
  shortName: string
  prefix: string
  serialLength: number
  unitsPerBooklet: number
}

export interface LguConfig {
  country: string
  region: string
  province: string
  municipality: string
  municipalityShort: string
  officeName: string
  officeAddress: string
  officeContact: string
  sealPath: string
  timezone: string
  currency: 'PHP'
  treasurerTitle: string
  marketSupervisorTitle: string
  markets: { id: string; name: string; shortName: string }[]
  accountableFormTypes: FormTypeConfig[]
  reports: {
    dailyCollectionFormTitle: string
    dailyCollectionFormCode: string
    accountabilityFormTitle: string
    accountabilityFormCode: string
  }
  sms: SmsSettings
  features: { digitalPayments: boolean }
}

export interface Session {
  userId: string
  /** Snapshot of the signed-in (or role-switched) user. */
  user: User
  role: Role
  verified: boolean
  rememberMe: boolean
  startedAt: ISODateTime
}

export type DateContext = { mode: 'today' } | { mode: 'day'; date: ISODate }
