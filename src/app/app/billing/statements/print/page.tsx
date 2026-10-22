'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { PrintBar } from '@/components/documents/document-page'
import { StatementDoc } from '@/components/documents/statement-doc'
import { RoleGate } from '@/components/shared/role-gate'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/misc'
import { api } from '@/lib/api'

export default function StatementPrintPage() {
  return (
    <RoleGate permission={['billing.view', 'lessees.view']} page="statements of account">
      <React.Suspense>
        <Print />
      </React.Suspense>
    </RoleGate>
  )
}

function Print() {
  const params = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean)
  const results = useQueries({ queries: ids.map((id) => ({ queryKey: ['statement', id, undefined], queryFn: () => api.billing.statement(id) })) })
  if (ids.length === 0) return <EmptyState title="No lessees selected" description="Choose lessees on the Statements of account page." />
  return (
    <>
      <title>Statements of account · MARCIS</title>
      <PrintBar backLabel="Back">
        <span className="text-sm text-ink-muted">
          {ids.length} statement{ids.length === 1 ? '' : 's'} · each prints on its own page
        </span>
      </PrintBar>
      <div className="grid gap-8">
        {results.map((r, i) =>
          r.data ? <StatementDoc key={ids[i]} s={r.data} /> : r.isError ? <ErrorState key={ids[i]} onRetry={() => r.refetch()} /> : <Skeleton key={ids[i]} className="mx-auto h-[900px] w-full max-w-[800px]" />,
        )}
      </div>
    </>
  )
}
