import type { Centavos, ISODate, ISODateTime, MonthKey } from './common'
import type { SectionCategory, StallType } from './market'

/* ---------------------------------------------------------------- Fees */

export type FeeKind = 'monthly_rental' | 'daily_fee' | 'transient_fee'

export interface FeeSchedule {
  id: string
  version: number
  name: string
  ordinanceRef: string
  effectiveFrom: ISODate
  effectiveTo: ISODate | null
  /** Penalty in basis points per month on overdue rental (200 = 2%). */
  penaltyRateBps: number
  penaltyRule: string
  penaltyOrdinanceRef: string
  createdAt: ISODateTime
  createdByName: string
  notes: string
}

export interface FeeRate {
  id: string
  scheduleId: string
  marketId: string
  sectionCategory: SectionCategory
  /** null = applies to every stall type in the category. */
  stallType: StallType | null
  kind: FeeKind
  /** Tier label, e.g. "Per tub (banyera)" for transient fees. */
  label: string | null
  amount: Centavos
  ordinanceRef: string
  effectiveFrom: ISODate
  effectiveTo: ISODate | null
}

/* --------------------------------------------------------- Collections */

export type CollectionType = 'daily_fee' | 'monthly_rental' | 'transient_fee' | 'penalty' | 'other'

export type CollectionStatus = 'pending_sync' | 'synced' | 'reconciled' | 'variance' | 'corrected'

export type CorrectionStatus = 'pending' | 'approved' | 'rejected'

export type FormTypeId = string

export interface Collection {
  /** Generated on the collector's device. */
  id: string
  collectorId: string
  deviceId: string
  marketId: string
  sectionId: string
  stallId: string | null
  leaseId: string | null
  lesseeId: string | null
  transientVendorName: string | null
  transientGoods: string | null
  type: CollectionType
  /** Signed. A correcting entry carries the adjustment (corrected − original). */
  amount: Centavos
  receiptSerial: string
  formType: FormTypeId
  businessDate: ISODate
  recordedAt: ISODateTime
  syncedAt: ISODateTime | null
  synced: boolean
  /** Display status; derived by the API from sync, correction and reconciliation state. */
  status: CollectionStatus
  correctsCollectionId: string | null
  correctedByCollectionId: string | null
  correctionReason: string | null
  correctionStatus: CorrectionStatus | null
  correctionRequestedBy: string | null
  correctionReviewedBy: string | null
  correctionReviewedAt: ISODateTime | null
  correctionReviewNote: string | null
  remarks: string | null
}

export interface CollectionView extends Collection {
  collectorName: string
  sectionName: string
  stallCode: string | null
  payerName: string
  /** Amount that counts toward totals (0 for a correction not yet approved). */
  countedAmount: Centavos
  isDuplicateSerial: boolean
}

/** Monthly totals migrated from pre-MARCIS ledgers (before the first synced day). */
export interface LegacyMonthly {
  month: MonthKey
  marketId: string
  sectionId: string
  type: CollectionType
  amount: Centavos
}

/* ------------------------------------------------------ Reconciliation */

export type ReconStatus = 'open' | 'balanced' | 'shortage' | 'overage' | 'closed'

export interface Remittance {
  id: string
  collectorId: string
  businessDate: ISODate
  amount: Centavos
  reference: string
  receivedByName: string
  receivedAt: ISODateTime
  notes: string
}

/** Stored state for one collector on one day; figures are derived. */
export interface ReconRecord {
  collectorId: string
  date: ISODate
  status: ReconStatus
  /** Status the row held before the day was closed (kept for reporting). */
  statusBeforeClose: Exclude<ReconStatus, 'closed'> | null
  flagReason: string | null
  markedByName: string | null
  markedAt: ISODateTime | null
  notes: string
}

export interface DayClose {
  date: ISODate
  closed: boolean
  closedByName: string | null
  closedAt: ISODateTime | null
  reopenings: { at: ISODateTime; byName: string; reason: string }[]
}

export interface SerialUsage {
  formType: FormTypeId
  first: string | null
  last: string | null
  count: number
  /** Serials missing inside the used range. */
  gaps: string[]
  /** Serials recorded more than once. */
  duplicates: string[]
  /** Ordered list of serials used, for the detail view. */
  sequence: { serial: string; collectionId: string; amount: Centavos; gap: boolean; duplicate: boolean }[]
  issuedRange: string | null
}

export interface ReconciliationDay {
  collectorId: string
  collectorName: string
  date: ISODate
  marketId: string
  sectionNames: string[]
  collectionsCount: number
  pendingSyncCount: number
  expected: Centavos
  remitted: Centavos
  /** remitted − expected. Negative = shortage. */
  variance: Centavos
  status: ReconStatus
  statusBeforeClose: Exclude<ReconStatus, 'closed'> | null
  flagReason: string | null
  markedByName: string | null
  notes: string
  serials: SerialUsage[]
  remittances: Remittance[]
}

export type CalendarDayState = 'closed' | 'open' | 'variance' | 'future'

export interface ReconCalendarDay {
  date: ISODate
  state: CalendarDayState
  closed: boolean
  variance: Centavos
}

/* -------------------------------------------------- Accountable forms */

export type SeriesStatus = 'in_stock' | 'issued' | 'exhausted' | 'returned' | 'missing'

export interface AccountableFormSeries {
  id: string
  formType: FormTypeId
  start: number
  end: number
  issuedTo: string | null
  issuedOn: ISODate | null
  issuedByName: string | null
  lastUsed: number | null
  usedCount: number
  status: SeriesStatus
  returnedOn: ISODate | null
  missingReason: string | null
  missingSerials: number[]
}

export interface AccountableFormSeriesView extends AccountableFormSeries {
  issuedToName: string | null
  remaining: number
}

export type FormAlertKind = 'gap' | 'out_of_order' | 'duplicate' | 'missing'

export interface FormAlert {
  id: string
  kind: FormAlertKind
  collectorId: string
  collectorName: string
  formType: FormTypeId
  serial: string
  date: ISODate
  note: string
}

/* ------------------------------------------------------------ Billing */

export type ChargeKind = 'rental' | 'penalty'

export interface Charge {
  id: string
  leaseId: string
  lesseeId: string
  stallId: string
  month: MonthKey
  kind: ChargeKind
  amount: Centavos
  dueDate: ISODate
  billingRunId: string | null
  note: string
}

export interface Payment {
  id: string
  leaseId: string
  lesseeId: string
  date: ISODate
  amount: Centavos
  kind: ChargeKind
  receiptSerial: string
  source: 'field_collection' | 'treasury_window'
  collectionId: string | null
}

export interface BillingRun {
  id: string
  month: MonthKey
  generatedAt: ISODateTime
  generatedByName: string
  leaseCount: number
  rentalTotal: Centavos
  penaltyTotal: Centavos
}

export interface BillingPreviewLine {
  leaseId: string
  leaseNo: string
  stallCode: string
  marketId: string
  sectionName: string
  lesseeName: string
  rental: Centavos
  overdueRental: Centavos
  penalty: Centavos
  total: Centavos
}

export interface BillingPreview {
  month: MonthKey
  alreadyGenerated: BillingRun | null
  lines: BillingPreviewLine[]
  rentalTotal: Centavos
  penaltyTotal: Centavos
  total: Centavos
  penaltyRateBps: number
  ordinanceRef: string
}

export interface StatementLine {
  date: ISODate
  description: string
  reference: string
  charge: Centavos
  payment: Centavos
  balance: Centavos
}

export interface StatementOfAccount {
  lesseeId: string
  lesseeName: string
  address: string
  stalls: { code: string; marketId: string; sectionName: string; leaseNo: string; monthlyRate: Centavos }[]
  asOf: ISODate
  periodFrom: ISODate
  openingBalance: Centavos
  lines: StatementLine[]
  totalCharges: Centavos
  totalPayments: Centavos
  closingBalance: Centavos
  aging: Record<AgingBucket, Centavos>
}

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus'

export interface ArrearsAccount {
  leaseId: string
  leaseNo: string
  lesseeId: string
  lesseeName: string
  stallId: string
  stallCode: string
  marketId: string
  sectionId: string
  sectionName: string
  balance: Centavos
  buckets: Record<AgingBucket, Centavos>
  oldestUnpaidMonth: MonthKey | null
  daysOverdue: number
  lastNotice: DemandNoticeLevel | null
}

export type DemandNoticeLevel = 'first' | 'second' | 'final'

export type NoticeResponse = 'none' | 'paid' | 'promised' | 'disputed'

export interface DemandNotice {
  id: string
  noticeNo: string
  lesseeId: string
  leaseId: string
  stallId: string
  level: DemandNoticeLevel
  amountDue: Centavos
  issuedOn: ISODate
  issuedByName: string
  dueBy: ISODate
  response: NoticeResponse
  responseDate: ISODate | null
  responseNote: string | null
}

export interface DemandNoticeView extends DemandNotice {
  lesseeName: string
  lesseeAddress: string
  stallCode: string
  marketId: string
  sectionName: string
  monthsOverdue: number
}
