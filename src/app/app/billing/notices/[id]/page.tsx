'use client'

import { useParams } from 'next/navigation'
import { DemandNoticeDoc } from '@/components/documents/demand-notice-doc'
import { PrintBar } from '@/components/documents/document-page'
import { RoleGate } from '@/components/shared/role-gate'
import { ErrorState, PageSkeleton } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { useNotice } from '@/hooks/api'

export default function NoticePrintPage() {
  const { id } = useParams<{ id: string }>()
  const q = useNotice(id)
  return (
    <RoleGate permission={['billing.view', 'lessees.view']} page="demand notices">
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.isError || !q.data ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          <title>{`${q.data.noticeNo} · MARCIS`}</title>
          <PrintBar>
            <StatusBadge kind="response" value={q.data.response} />
          </PrintBar>
          <DemandNoticeDoc n={q.data} />
        </>
      )}
    </RoleGate>
  )
}
