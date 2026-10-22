/**
 * Service contracts. The UI only depends on these interfaces; the mock
 * implementation lives in ./mock and a Laravel HTTP implementation can be
 * dropped in by changing the export in ./index.ts.
 */
import type {
  AccountableFormSeriesView,
  AgingBucket,
  AppNotification,
  ArrearsAccount,
  AuditEntry,
  BillingPreview,
  BillingRun,
  BrandingSettings,
  Centavos,
  CollectionStatus,
  CollectionType,
  CollectionView,
  CollectorView,
  DayClose,
  DemandNoticeLevel,
  DemandNoticeView,
  Device,
  DeviceEvent,
  FeeRate,
  FeeSchedule,
  FormAlert,
  FormTypeConfig,
  ISODate,
  ISODateTime,
  LeaseView,
  Lessee,
  LesseeView,
  Market,
  MarketScope,
  MonthKey,
  NoticeResponse,
  Payment,
  ReconCalendarDay,
  ReconciliationDay,
  Role,
  Section,
  SmsMessage,
  SmsSettings,
  SmsStatus,
  SmsTemplate,
  StallDocument,
  StallStatus,
  StallStatusChange,
  StallType,
  StallView,
  StatementLine,
  StatementOfAccount,
  SystemStatus,
  User,
  Assignment,
  AccountableFormSeries,
} from '@/types'

/* ------------------------------------------------------------- stalls */

export interface StallFilters {
  market: MarketScope
  status?: StallStatus | 'all'
  sectionId?: string | 'all'
  inArrears?: boolean
  expiring?: boolean
  q?: string
}

export interface StallDetail {
  stall: StallView
  lease: LeaseView | null
  leaseHistory: LeaseView[]
  ledger: StatementLine[]
  arrears: ArrearsAccount | null
  recentPayments: Payment[]
  statusHistory: StallStatusChange[]
  documents: StallDocument[]
  dailyFee: Centavos | null
  monthlyRateQuote: Centavos | null
}

export interface StallsService {
  markets(): Promise<Market[]>
  sections(market?: MarketScope): Promise<Section[]>
  list(filters: StallFilters): Promise<StallView[]>
  get(id: string): Promise<StallDetail>
  setStatus(id: string, input: { status: StallStatus; note: string }): Promise<StallView>
}

/* ------------------------------------------------------------ lessees */

export interface LesseeFilters {
  market: MarketScope
  q?: string
  withBalance?: boolean
}

export interface LesseeInput {
  firstName: string
  middleInitial: string
  lastName: string
  businessName: string
  contactNumber: string
  email: string
  address: string
  smsConsent: boolean
  notes: string
}

export interface LesseeDetail {
  lessee: LesseeView
  leases: LeaseView[]
  statement: StatementOfAccount
  notices: DemandNoticeView[]
  sms: SmsMessage[]
  documents: StallDocument[]
}

export interface LesseesService {
  list(filters: LesseeFilters): Promise<LesseeView[]>
  get(id: string): Promise<LesseeDetail>
  create(input: LesseeInput): Promise<Lessee>
  update(id: string, input: LesseeInput): Promise<Lessee>
}

/* ------------------------------------------------------------- leases */

export type LeaseTab = 'active' | 'expiring' | 'expired' | 'terminated'

export interface LeaseFilters {
  market: MarketScope
  tab: LeaseTab
  withinDays?: 30 | 60 | 90
  q?: string
}

export interface RateQuote {
  rate: FeeRate
  schedule: FeeSchedule
  dailyFee: FeeRate | null
}

export interface NewLeaseInput {
  stallId: string
  lesseeId: string | null
  newLessee: LesseeInput | null
  startDate: ISODate
  termMonths: number
  monthlyRate: Centavos
  deposit: Centavos
  specialConditions: string
}

export interface LeaseDetail {
  lease: LeaseView
  stall: StallView
  lessee: Lessee
  quote: RateQuote
  history: LeaseView[]
}

export interface LeasesService {
  list(filters: LeaseFilters): Promise<LeaseView[]>
  get(id: string): Promise<LeaseDetail>
  quote(stallId: string, onDate: ISODate): Promise<RateQuote>
  create(input: NewLeaseInput): Promise<LeaseView>
  renew(id: string, input: { startDate: ISODate; termMonths: number; monthlyRate: Centavos; reason: string }): Promise<LeaseView>
  terminate(id: string, input: { effectiveDate: ISODate; reason: string }): Promise<LeaseView>
}

/* -------------------------------------------------------- collections */

export interface CollectionFilters {
  market: MarketScope
  from: ISODate
  to: ISODate
  collectorId?: string | 'all'
  sectionId?: string | 'all'
  type?: CollectionType | 'all'
  status?: CollectionStatus | 'all' | 'correction_pending'
  serialFrom?: string
  serialTo?: string
  q?: string
}

export interface CollectionDetail {
  collection: CollectionView
  linked: CollectionView[]
}

export interface TransientDay {
  date: ISODate
  vendors: number
  amount: Centavos
}

export interface CollectionsService {
  list(filters: CollectionFilters): Promise<CollectionView[]>
  get(id: string): Promise<CollectionDetail>
  requestCorrection(id: string, input: { correctedAmount: Centavos; reason: string }): Promise<CollectionView>
  reviewCorrection(correctionId: string, input: { approve: boolean; note: string }): Promise<CollectionView>
  transientDays(input: { market: MarketScope; from: ISODate; to: ISODate }): Promise<TransientDay[]>
}

/* ----------------------------------------------------- reconciliation */

export interface ReconDayResult {
  date: ISODate
  rows: ReconciliationDay[]
  dayClose: DayClose
  canClose: boolean
  closeBlockers: string[]
}

export interface RecordRemittanceInput {
  collectorId: string
  date: ISODate
  amount: Centavos
  reference: string
  notes: string
}

export interface ReportOfCollections {
  row: ReconciliationDay
  collector: CollectorView
  byType: { type: CollectionType; count: number; amount: Centavos }[]
  collections: CollectionView[]
}

export interface ReconciliationService {
  day(date: ISODate, market: MarketScope): Promise<ReconDayResult>
  calendar(month: MonthKey, market: MarketScope): Promise<ReconCalendarDay[]>
  recordRemittance(input: RecordRemittanceInput): Promise<ReconciliationDay>
  markBalanced(collectorId: string, date: ISODate): Promise<ReconciliationDay>
  flagVariance(collectorId: string, date: ISODate, reason: string): Promise<ReconciliationDay>
  closeDay(date: ISODate): Promise<DayClose>
  reopenDay(date: ISODate, reason: string): Promise<DayClose>
  reportOfCollections(collectorId: string, date: ISODate): Promise<ReportOfCollections>
}

/* -------------------------------------------------- accountable forms */

export interface SeriesFilters {
  formType?: string | 'all'
  collectorId?: string | 'all'
  status?: AccountableFormSeries['status'] | 'all'
}

export interface AccountabilitySummary {
  collector: CollectorView
  month: MonthKey
  rows: {
    formType: string
    formName: string
    beginning: { from: string; to: string; qty: number } | null
    received: { from: string; to: string; qty: number }[]
    issued: { from: string; to: string; qty: number } | null
    ending: { from: string; to: string; qty: number } | null
  }[]
  alerts: FormAlert[]
}

export interface AccountableFormsService {
  formTypes(): Promise<FormTypeConfig[]>
  series(filters: SeriesFilters): Promise<AccountableFormSeriesView[]>
  alerts(): Promise<FormAlert[]>
  issue(input: { formType: string; start: number; end: number; collectorId: string; issuedOn: ISODate }): Promise<AccountableFormSeriesView>
  returnUnused(id: string): Promise<AccountableFormSeriesView>
  reportMissing(id: string, input: { from: number; to: number; reason: string }): Promise<AccountableFormSeriesView>
  summary(collectorId: string, month: MonthKey): Promise<AccountabilitySummary>
}

/* ------------------------------------------------------------ billing */

export interface ArrearsFilters {
  market: MarketScope
  sectionId?: string | 'all'
  bucket?: AgingBucket | 'all' | 'overdue'
}

export interface AgingBySection {
  sectionId: string
  sectionName: string
  marketId: string
  buckets: Record<AgingBucket, Centavos>
  total: Centavos
}

export interface NoticeFilters {
  market: MarketScope
  level?: DemandNoticeLevel | 'all'
  response?: NoticeResponse | 'all'
}

export interface NoticeCandidate {
  account: ArrearsAccount
  suggestedLevel: DemandNoticeLevel
}

export interface BillingService {
  runs(): Promise<BillingRun[]>
  preview(month: MonthKey): Promise<BillingPreview>
  generate(month: MonthKey): Promise<BillingRun>
  arrears(filters: ArrearsFilters): Promise<ArrearsAccount[]>
  agingBySection(market: MarketScope): Promise<AgingBySection[]>
  statement(lesseeId: string, asOf?: ISODate): Promise<StatementOfAccount>
  notices(filters: NoticeFilters): Promise<DemandNoticeView[]>
  notice(id: string): Promise<DemandNoticeView>
  noticeCandidates(market: MarketScope): Promise<NoticeCandidate[]>
  issueNotices(input: { leaseIds: string[] }): Promise<DemandNoticeView[]>
  recordNoticeResponse(id: string, input: { response: NoticeResponse; note: string }): Promise<DemandNoticeView>
  penaltyPolicy(): Promise<{ schedule: FeeSchedule }>
}

/* ----------------------------------------------------------- messages */

export type RecipientGroup = 'overdue' | 'expiring' | 'section' | 'selected'

export interface Recipient {
  lesseeId: string
  name: string
  phone: string
  stallCodes: string[]
  marketId: string
  balance: Centavos
  leaseEnd: ISODate | null
  monthlyRate: Centavos
}

export interface SmsUsage {
  year: number
  used: number
  allowance: number
  warnAtPercent: number
  sentThisMonth: number
  failedThisMonth: number
}

export interface MessageFilters {
  status?: SmsStatus | 'all'
  templateId?: string | 'all'
  q?: string
}

export interface MessagesService {
  templates(): Promise<SmsTemplate[]>
  log(filters: MessageFilters): Promise<SmsMessage[]>
  usage(): Promise<SmsUsage>
  recipients(input: { group: RecipientGroup; market: MarketScope; sectionId?: string; lesseeIds?: string[] }): Promise<{ eligible: Recipient[]; excludedNoConsent: number }>
  send(input: { templateId: string; lesseeIds: string[]; scheduleAt: ISODateTime | null }): Promise<{ queued: number; units: number }>
  settings(): Promise<SmsSettings>
}

/* --------------------------------------------------------- collectors */

export interface CollectorDetail {
  collector: CollectorView
  assignments: (Assignment & { sectionName: string })[]
  series: AccountableFormSeriesView[]
  dailyTotals: { date: ISODate; amount: Centavos; remitted: Centavos; variance: Centavos; hasRemittance: boolean }[]
  varianceHistory: ReconciliationDay[]
  devices: Device[]
  deviceEvents: DeviceEvent[]
}

export interface CollectorsService {
  list(market: MarketScope, date: ISODate): Promise<CollectorView[]>
  get(id: string, month: MonthKey): Promise<CollectorDetail>
  assignSections(id: string, sectionIds: string[]): Promise<CollectorView>
  suspend(id: string, reason: string): Promise<CollectorView>
  reinstate(id: string): Promise<CollectorView>
  deactivateDevice(deviceId: string, reason: string): Promise<Device>
}

/* ---------------------------------------------------------- dashboard */

export interface CollectorTodayRow {
  collectorId: string
  collectorName: string
  code: string
  sectionNames: string[]
  count: number
  amount: Centavos
  lastSyncAt: ISODateTime | null
  stale: boolean
  unsyncedCount: number
  remitted: Centavos
  hasRemittance: boolean
  variance: Centavos
}

export interface DashboardAlert {
  id: string
  kind: 'unsynced' | 'unreconciled' | 'serial' | 'vacant'
  title: string
  detail: string
  href: string
  severity: 'warning' | 'danger'
}

export interface DashboardSummary {
  date: ISODate
  isToday: boolean
  collected: { amount: Centavos; compare: Centavos; compareLabel: string; spark: Centavos[] }
  month: { amount: Centavos; target: Centavos; month: MonthKey; spark: Centavos[] }
  occupancy: { occupied: number; total: number; rateBps: number; spark: number[] }
  arrears: { amount: Centavos; accounts: number }
  variances: { count: number; amount: Centavos }
  byCollector: CollectorTodayRow[]
  bySection: { sectionId: string; name: string; marketId: string; amount: Centavos }[]
  trend: { date: ISODate; amount: Centavos }[]
  monthly: { month: MonthKey; amount: Centavos }[]
  aging: Record<AgingBucket, Centavos>
  expiring: LeaseView[]
  alerts: DashboardAlert[]
}

export interface DashboardService {
  summary(date: ISODate, market: MarketScope): Promise<DashboardSummary>
}

/* ------------------------------------------------------------ reports */

export interface DailyReport {
  date: ISODate
  rows: { collectorId: string; collectorName: string; byType: Record<CollectionType, Centavos>; count: number; total: Centavos; remitted: Centavos; variance: Centavos }[]
}

export interface MonthlySectionReport {
  month: MonthKey
  rows: { sectionId: string; sectionName: string; marketId: string; byType: Record<CollectionType, Centavos>; total: Centavos; previous: Centavos }[]
}

export interface CollectorPerformanceReport {
  month: MonthKey
  rows: { collectorId: string; collectorName: string; days: number; collections: number; amount: Centavos; shortageDays: number; shortage: Centavos; overage: Centavos; avgSyncDelayMin: number }[]
}

export interface OccupancyReport {
  history: { month: MonthKey; occupied: number; total: number }[]
  bySection: { sectionId: string; sectionName: string; marketId: string; occupied: number; vacant: number; reserved: number; repair: number; total: number }[]
  vacant: { stallId: string; code: string; sectionName: string; marketId: string; status: StallStatus; since: ISODate | null; days: number; monthlyRate: Centavos }[]
}

export interface YearlyTrendReport {
  year: number
  months: { month: string; label: string; current: Centavos | null; previous: Centavos }[]
  currentTotal: Centavos
  previousSamePeriod: Centavos
}

export interface SbSummaryReport {
  month: MonthKey
  collections: { marketId: string; amount: Centavos; previousYear: Centavos }[]
  byType: { type: CollectionType; amount: Centavos }[]
  occupancy: { marketId: string; occupied: number; total: number }[]
  aging: Record<AgingBucket, Centavos>
  arrearsAccounts: number
  rates: { label: string; amount: Centavos; ordinanceRef: string }[]
}

export interface ReportsService {
  daily(date: ISODate, market: MarketScope): Promise<DailyReport>
  monthlyBySection(month: MonthKey, market: MarketScope): Promise<MonthlySectionReport>
  collectorPerformance(month: MonthKey, market: MarketScope): Promise<CollectorPerformanceReport>
  occupancy(market: MarketScope): Promise<OccupancyReport>
  yearlyTrend(year: number, market: MarketScope): Promise<YearlyTrendReport>
  sbSummary(month: MonthKey): Promise<SbSummaryReport>
}

/* ----------------------------------------------------------- settings */

export interface FeeRateChange {
  rateId: string
  amount: Centavos
}

export interface SettingsService {
  users(): Promise<User[]>
  inviteUser(input: { name: string; email: string; role: Role; title: string }): Promise<User>
  changeRole(userId: string, role: Role): Promise<User>
  setUserStatus(userId: string, status: User['status']): Promise<User>
  feeSchedules(): Promise<{ schedules: FeeSchedule[]; rates: FeeRate[] }>
  createFeeVersion(input: { effectiveFrom: ISODate; ordinanceRef: string; notes: string; changes: FeeRateChange[]; penaltyRateBps: number }): Promise<FeeSchedule>
  updateSection(id: string, input: Partial<Pick<Section, 'name' | 'x' | 'y' | 'cols' | 'rows'>>): Promise<Section>
  moveStall(stallId: string, gridX: number, gridY: number): Promise<StallView>
  addStall(input: { sectionId: string; type: StallType; sizeSqm: number; gridX: number; gridY: number }): Promise<StallView>
  formTypes(): Promise<FormTypeConfig[]>
  updateFormType(id: string, input: Partial<Omit<FormTypeConfig, 'id'>>): Promise<FormTypeConfig>
  sms(): Promise<{ settings: SmsSettings; templates: SmsTemplate[] }>
  updateSms(input: SmsSettings): Promise<SmsSettings>
  updateTemplate(id: string, input: { name: string; body: string }): Promise<SmsTemplate>
  branding(): Promise<BrandingSettings>
  updateBranding(input: BrandingSettings): Promise<BrandingSettings>
  audit(input: { q?: string; action?: string }): Promise<AuditEntry[]>
  system(): Promise<SystemStatus>
}

/* ------------------------------------------------------ notifications */

export interface NotificationsService {
  list(): Promise<AppNotification[]>
  markRead(id: string): Promise<void>
  markAllRead(): Promise<void>
}

/* ------------------------------------------------------------- search */

export interface SearchResults {
  stalls: { id: string; code: string; marketId: string; sectionName: string; lesseeName: string | null }[]
  lessees: { id: string; name: string; stallCodes: string[] }[]
  collections: { id: string; serial: string; formType: string; amount: Centavos; date: ISODate; collectorName: string }[]
}

export interface SearchService {
  search(q: string): Promise<SearchResults>
}

/* ------------------------------------------------------------- auth */

export interface AuthService {
  login(input: { email: string; password: string }): Promise<{ user: User; needsVerification: boolean }>
  verify(input: { userId: string; code: string }): Promise<{ ok: boolean }>
  requestReset(email: string): Promise<void>
  demoUsers(): Promise<User[]>
}

export interface Api {
  auth: AuthService
  stalls: StallsService
  lessees: LesseesService
  leases: LeasesService
  collections: CollectionsService
  reconciliation: ReconciliationService
  accountableForms: AccountableFormsService
  billing: BillingService
  messages: MessagesService
  collectors: CollectorsService
  dashboard: DashboardService
  reports: ReportsService
  settings: SettingsService
  notifications: NotificationsService
  search: SearchService
}

