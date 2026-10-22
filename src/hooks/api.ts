'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type ArrearsFilters,
  type CollectionFilters,
  type LeaseFilters,
  type LesseeFilters,
  type LesseeInput,
  type MessageFilters,
  type NewLeaseInput,
  type NoticeFilters,
  type RecipientGroup,
  type RecordRemittanceInput,
  type ReconDayResult,
  type SeriesFilters,
  type StallFilters,
  type FeeRateChange,
} from '@/lib/api'
import type { AppNotification, BrandingSettings, ISODate, ISODateTime, MarketScope, MonthKey, NoticeResponse, Role, SmsSettings, StallStatus, StallType, User, FormTypeConfig } from '@/types'

/* Every mock mutation can touch several screens (a remittance changes the
   dashboard, the ledger and the collector page), so mutations refresh all
   active queries. */
function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate() })
}

/* -------------------------------------------------------------- stalls */
export const useMarkets = () => useQuery({ queryKey: ['markets'], queryFn: () => api.stalls.markets(), staleTime: Infinity })
export const useSections = (market: MarketScope = 'all') =>
  useQuery({ queryKey: ['sections', market], queryFn: () => api.stalls.sections(market), staleTime: 5 * 60_000 })
export const useStalls = (filters: StallFilters) =>
  useQuery({ queryKey: ['stalls', filters], queryFn: () => api.stalls.list(filters), placeholderData: keepPreviousData })
export const useStall = (id: string | null) =>
  useQuery({ queryKey: ['stall', id], queryFn: () => api.stalls.get(id!), enabled: Boolean(id) })
export const useSetStallStatus = () => useAction((a: { id: string; status: StallStatus; note: string }) => api.stalls.setStatus(a.id, a))

/* ------------------------------------------------------------- lessees */
export const useLessees = (filters: LesseeFilters) =>
  useQuery({ queryKey: ['lessees', filters], queryFn: () => api.lessees.list(filters), placeholderData: keepPreviousData })
export const useLessee = (id: string) => useQuery({ queryKey: ['lessee', id], queryFn: () => api.lessees.get(id) })
export const useCreateLessee = () => useAction((input: LesseeInput) => api.lessees.create(input))
export const useUpdateLessee = () => useAction((a: { id: string; input: LesseeInput }) => api.lessees.update(a.id, a.input))

/* -------------------------------------------------------------- leases */
export const useLeases = (filters: LeaseFilters) =>
  useQuery({ queryKey: ['leases', filters], queryFn: () => api.leases.list(filters), placeholderData: keepPreviousData })
export const useLease = (id: string) => useQuery({ queryKey: ['lease', id], queryFn: () => api.leases.get(id) })
export const useRateQuote = (stallId: string | null, onDate: ISODate) =>
  useQuery({ queryKey: ['quote', stallId, onDate], queryFn: () => api.leases.quote(stallId!, onDate), enabled: Boolean(stallId) })
export const useCreateLease = () => useAction((input: NewLeaseInput) => api.leases.create(input))
export const useRenewLease = () =>
  useAction((a: { id: string; startDate: ISODate; termMonths: number; monthlyRate: number; reason: string }) => api.leases.renew(a.id, a))
export const useTerminateLease = () => useAction((a: { id: string; effectiveDate: ISODate; reason: string }) => api.leases.terminate(a.id, a))

/* --------------------------------------------------------- collections */
export const useCollections = (filters: CollectionFilters) =>
  useQuery({ queryKey: ['collections', filters], queryFn: () => api.collections.list(filters), placeholderData: keepPreviousData })
export const useCollection = (id: string | null) =>
  useQuery({ queryKey: ['collection', id], queryFn: () => api.collections.get(id!), enabled: Boolean(id) })
export const useRequestCorrection = () =>
  useAction((a: { id: string; correctedAmount: number; reason: string }) => api.collections.requestCorrection(a.id, a))
export const useReviewCorrection = () => useAction((a: { id: string; approve: boolean; note: string }) => api.collections.reviewCorrection(a.id, a))
export const useTransientDays = (market: MarketScope, from: ISODate, to: ISODate) =>
  useQuery({ queryKey: ['transient-days', market, from, to], queryFn: () => api.collections.transientDays({ market, from, to }) })

/* ------------------------------------------------------ reconciliation */
export const useReconciliationDay = (date: ISODate, market: MarketScope) =>
  useQuery({ queryKey: ['recon-day', date, market], queryFn: () => api.reconciliation.day(date, market), placeholderData: keepPreviousData })
export const useReconCalendar = (month: MonthKey, market: MarketScope) =>
  useQuery({ queryKey: ['recon-calendar', month, market], queryFn: () => api.reconciliation.calendar(month, market), placeholderData: keepPreviousData })
export const useRecordRemittance = () => useAction((input: RecordRemittanceInput) => api.reconciliation.recordRemittance(input))
export const useFlagVariance = () => useAction((a: { collectorId: string; date: ISODate; reason: string }) => api.reconciliation.flagVariance(a.collectorId, a.date, a.reason))
export const useCloseDay = () => useAction((date: ISODate) => api.reconciliation.closeDay(date))
export const useReopenDay = () => useAction((a: { date: ISODate; reason: string }) => api.reconciliation.reopenDay(a.date, a.reason))
export const useReportOfCollections = (collectorId: string, date: ISODate) =>
  useQuery({ queryKey: ['rcd', collectorId, date], queryFn: () => api.reconciliation.reportOfCollections(collectorId, date), enabled: Boolean(collectorId) })

/** Optimistic: the row flips to Balanced immediately, then the server confirms. */
export function useMarkBalanced() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: { collectorId: string; date: ISODate }) => api.reconciliation.markBalanced(a.collectorId, a.date),
    onMutate: async (a) => {
      await qc.cancelQueries({ queryKey: ['recon-day', a.date] })
      const snapshots = qc.getQueriesData<ReconDayResult>({ queryKey: ['recon-day', a.date] })
      for (const [key, data] of snapshots) {
        if (!data) continue
        qc.setQueryData<ReconDayResult>(key, {
          ...data,
          rows: data.rows.map((r) => (r.collectorId === a.collectorId ? { ...r, status: 'balanced' } : r)),
        })
      }
      return { snapshots }
    },
    onError: (_e, _a, context) => {
      for (const [key, data] of context?.snapshots ?? []) qc.setQueryData(key, data)
    },
    onSettled: () => qc.invalidateQueries(),
  })
}

/* --------------------------------------------------- accountable forms */
export const useFormTypes = () => useQuery({ queryKey: ['form-types'], queryFn: () => api.accountableForms.formTypes(), staleTime: 5 * 60_000 })
export const useFormSeries = (filters: SeriesFilters) =>
  useQuery({ queryKey: ['form-series', filters], queryFn: () => api.accountableForms.series(filters), placeholderData: keepPreviousData })
export const useFormAlerts = () => useQuery({ queryKey: ['form-alerts'], queryFn: () => api.accountableForms.alerts() })
export const useIssueSeries = () =>
  useAction((input: { formType: string; start: number; end: number; collectorId: string; issuedOn: ISODate }) => api.accountableForms.issue(input))
export const useReturnSeries = () => useAction((id: string) => api.accountableForms.returnUnused(id))
export const useReportMissing = () => useAction((a: { id: string; from: number; to: number; reason: string }) => api.accountableForms.reportMissing(a.id, a))
export const useAccountabilitySummary = (collectorId: string, month: MonthKey) =>
  useQuery({ queryKey: ['raaf', collectorId, month], queryFn: () => api.accountableForms.summary(collectorId, month), enabled: Boolean(collectorId) })

/* ------------------------------------------------------------- billing */
export const useBillingRuns = () => useQuery({ queryKey: ['billing-runs'], queryFn: () => api.billing.runs() })
export const useBillingPreview = (month: MonthKey) =>
  useQuery({ queryKey: ['billing-preview', month], queryFn: () => api.billing.preview(month), placeholderData: keepPreviousData })
export const useGenerateBilling = () => useAction((month: MonthKey) => api.billing.generate(month))
export const useArrears = (filters: ArrearsFilters) =>
  useQuery({ queryKey: ['arrears', filters], queryFn: () => api.billing.arrears(filters), placeholderData: keepPreviousData })
export const useAgingBySection = (market: MarketScope) =>
  useQuery({ queryKey: ['aging-sections', market], queryFn: () => api.billing.agingBySection(market) })
export const useStatement = (lesseeId: string | null, asOf?: ISODate) =>
  useQuery({ queryKey: ['statement', lesseeId, asOf], queryFn: () => api.billing.statement(lesseeId!, asOf), enabled: Boolean(lesseeId) })
export const useNotices = (filters: NoticeFilters) =>
  useQuery({ queryKey: ['notices', filters], queryFn: () => api.billing.notices(filters), placeholderData: keepPreviousData })
export const useNotice = (id: string) => useQuery({ queryKey: ['notice', id], queryFn: () => api.billing.notice(id) })
export const useNoticeCandidates = (market: MarketScope) =>
  useQuery({ queryKey: ['notice-candidates', market], queryFn: () => api.billing.noticeCandidates(market) })
export const useIssueNotices = () => useAction((leaseIds: string[]) => api.billing.issueNotices({ leaseIds }))
export const useNoticeResponse = () => useAction((a: { id: string; response: NoticeResponse; note: string }) => api.billing.recordNoticeResponse(a.id, a))
export const usePenaltyPolicy = () => useQuery({ queryKey: ['penalty-policy'], queryFn: () => api.billing.penaltyPolicy() })

/* ------------------------------------------------------------ messages */
export const useSmsTemplates = () => useQuery({ queryKey: ['sms-templates'], queryFn: () => api.messages.templates() })
export const useSmsLog = (filters: MessageFilters) =>
  useQuery({ queryKey: ['sms-log', filters], queryFn: () => api.messages.log(filters), placeholderData: keepPreviousData })
export const useSmsUsage = () => useQuery({ queryKey: ['sms-usage'], queryFn: () => api.messages.usage() })
export const useSmsSettings = () => useQuery({ queryKey: ['sms-settings'], queryFn: () => api.messages.settings() })
export const useRecipients = (input: { group: RecipientGroup; market: MarketScope; sectionId?: string; lesseeIds?: string[] }) =>
  useQuery({ queryKey: ['recipients', input], queryFn: () => api.messages.recipients(input), placeholderData: keepPreviousData })
export const useSendSms = () =>
  useAction((input: { templateId: string; lesseeIds: string[]; scheduleAt: ISODateTime | null }) => api.messages.send(input))

/* ---------------------------------------------------------- collectors */
export const useCollectors = (market: MarketScope, date: ISODate) =>
  useQuery({ queryKey: ['collectors', market, date], queryFn: () => api.collectors.list(market, date), placeholderData: keepPreviousData })
export const useCollector = (id: string, month: MonthKey) =>
  useQuery({ queryKey: ['collector', id, month], queryFn: () => api.collectors.get(id, month), placeholderData: keepPreviousData })
export const useAssignSections = () => useAction((a: { id: string; sectionIds: string[] }) => api.collectors.assignSections(a.id, a.sectionIds))
export const useSuspendCollector = () => useAction((a: { id: string; reason: string }) => api.collectors.suspend(a.id, a.reason))
export const useReinstateCollector = () => useAction((id: string) => api.collectors.reinstate(id))
export const useDeactivateDevice = () => useAction((a: { deviceId: string; reason: string }) => api.collectors.deactivateDevice(a.deviceId, a.reason))

/* ----------------------------------------------------- dashboard/reports */
export const useDashboard = (date: ISODate, market: MarketScope) =>
  useQuery({ queryKey: ['dashboard', date, market], queryFn: () => api.dashboard.summary(date, market), placeholderData: keepPreviousData })
export const useDailyReport = (date: ISODate, market: MarketScope) =>
  useQuery({ queryKey: ['report-daily', date, market], queryFn: () => api.reports.daily(date, market), placeholderData: keepPreviousData })
export const useMonthlySectionReport = (month: MonthKey, market: MarketScope) =>
  useQuery({ queryKey: ['report-monthly', month, market], queryFn: () => api.reports.monthlyBySection(month, market), placeholderData: keepPreviousData })
export const useCollectorPerformance = (month: MonthKey, market: MarketScope) =>
  useQuery({ queryKey: ['report-performance', month, market], queryFn: () => api.reports.collectorPerformance(month, market), placeholderData: keepPreviousData })
export const useOccupancyReport = (market: MarketScope) =>
  useQuery({ queryKey: ['report-occupancy', market], queryFn: () => api.reports.occupancy(market), placeholderData: keepPreviousData })
export const useYearlyTrend = (year: number, market: MarketScope) =>
  useQuery({ queryKey: ['report-yearly', year, market], queryFn: () => api.reports.yearlyTrend(year, market), placeholderData: keepPreviousData })
export const useSbSummary = (month: MonthKey) =>
  useQuery({ queryKey: ['report-sb', month], queryFn: () => api.reports.sbSummary(month), placeholderData: keepPreviousData })

/* ------------------------------------------------------------ settings */
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api.settings.users() })
export const useInviteUser = () => useAction((input: { name: string; email: string; role: Role; title: string }) => api.settings.inviteUser(input))
export const useChangeRole = () => useAction((a: { userId: string; role: Role }) => api.settings.changeRole(a.userId, a.role))
export const useSetUserStatus = () => useAction((a: { userId: string; status: User['status'] }) => api.settings.setUserStatus(a.userId, a.status))
export const useFeeSchedules = () => useQuery({ queryKey: ['fee-schedules'], queryFn: () => api.settings.feeSchedules() })
export const useCreateFeeVersion = () =>
  useAction((input: { effectiveFrom: ISODate; ordinanceRef: string; notes: string; changes: FeeRateChange[]; penaltyRateBps: number }) => api.settings.createFeeVersion(input))
export const useMoveStall = () => useAction((a: { stallId: string; gridX: number; gridY: number }) => api.settings.moveStall(a.stallId, a.gridX, a.gridY))
export const useAddStall = () =>
  useAction((input: { sectionId: string; type: StallType; sizeSqm: number; gridX: number; gridY: number }) => api.settings.addStall(input))
export const useUpdateSection = () => useAction((a: { id: string; name: string }) => api.settings.updateSection(a.id, { name: a.name }))
export const useSettingsFormTypes = () => useQuery({ queryKey: ['settings-form-types'], queryFn: () => api.settings.formTypes() })
export const useUpdateFormType = () => useAction((a: { id: string; input: Partial<Omit<FormTypeConfig, 'id'>> }) => api.settings.updateFormType(a.id, a.input))
export const useSmsConfig = () => useQuery({ queryKey: ['settings-sms'], queryFn: () => api.settings.sms() })
export const useUpdateSms = () => useAction((input: SmsSettings) => api.settings.updateSms(input))
export const useUpdateTemplate = () => useAction((a: { id: string; name: string; body: string }) => api.settings.updateTemplate(a.id, a))
export const useBranding = () => useQuery({ queryKey: ['branding'], queryFn: () => api.settings.branding() })
export const useUpdateBranding = () => useAction((input: BrandingSettings) => api.settings.updateBranding(input))
export const useAuditLog = (q: string, action: string) =>
  useQuery({ queryKey: ['audit', q, action], queryFn: () => api.settings.audit({ q, action }), placeholderData: keepPreviousData })
export const useSystemStatus = () => useQuery({ queryKey: ['system'], queryFn: () => api.settings.system() })

/* ------------------------------------------------------- notifications */
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications.list() })

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] })
      const prev = qc.getQueryData<AppNotification[]>(['notifications'])
      qc.setQueryData<AppNotification[]>(['notifications'], (list) => list?.map((n) => (n.id === id ? { ...n, read: true } : n)))
      return { prev }
    },
    onError: (_e, _id, context) => qc.setQueryData(['notifications'], context?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] })
      const prev = qc.getQueryData<AppNotification[]>(['notifications'])
      qc.setQueryData<AppNotification[]>(['notifications'], (list) => list?.map((n) => ({ ...n, read: true })))
      return { prev }
    },
    onError: (_e, _v, context) => qc.setQueryData(['notifications'], context?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

/* -------------------------------------------------------------- search */
export const useSearch = (q: string) =>
  useQuery({ queryKey: ['search', q], queryFn: () => api.search.search(q), enabled: q.trim().length >= 2, placeholderData: keepPreviousData })
