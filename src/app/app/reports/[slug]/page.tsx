'use client'

import { notFound, useParams } from 'next/navigation'
import { ArrearsAgingReport, CollectorPerformanceReport, DailyCollectionsReport, MonthlyCollectionsReport, OccupancyReport, SbSummaryReport, YearlyTrendReport } from '@/components/reports/reports'
import { NoAccess } from '@/components/shared/states'
import { RoleGate } from '@/components/shared/role-gate'
import { SB_REPORTS } from '@/lib/permissions'
import { useSession } from '@/lib/session'

const REPORTS: Record<string, () => React.JSX.Element> = {
  'daily-collections': DailyCollectionsReport,
  'monthly-collections': MonthlyCollectionsReport,
  'collector-performance': CollectorPerformanceReport,
  occupancy: OccupancyReport,
  'arrears-aging': ArrearsAgingReport,
  'yearly-trend': YearlyTrendReport,
  'sb-summary': SbSummaryReport,
}

export default function ReportPage() {
  const { slug } = useParams<{ slug: string }>()
  const { role } = useSession()
  const Report = REPORTS[slug]
  if (!Report) notFound()
  if (role === 'sb' && !(SB_REPORTS as readonly string[]).includes(slug)) return <NoAccess what="this report" />
  return (
    <RoleGate permission="reports.view" page="reports">
      <Report />
    </RoleGate>
  )
}
