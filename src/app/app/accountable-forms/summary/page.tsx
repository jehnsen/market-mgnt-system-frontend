'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { DocTable, DocumentPage, PrintBar } from '@/components/documents/document-page'
import { RoleGate } from '@/components/shared/role-gate'
import { ErrorState, PageSkeleton } from '@/components/shared/states'
import { Input, NativeSelect } from '@/components/ui/input'
import { lguConfig } from '@/config/lgu'
import { useAccountabilitySummary, useCollectors } from '@/hooks/api'
import { useAppContext } from '@/lib/app-context'
import { formatDate, formatMonth, monthKey } from '@/lib/dates'

export default function AccountabilitySummaryPage() {
  return (
    <RoleGate permission="forms.view" page="accountability summaries">
      <React.Suspense>
        <Summary />
      </React.Suspense>
    </RoleGate>
  )
}

function Summary() {
  const params = useSearchParams()
  const { today } = useAppContext()
  const [collectorId, setCollectorId] = React.useState(params.get('collector') ?? 'col-01')
  const [month, setMonth] = React.useState(params.get('month') ?? monthKey(today))
  const collectors = useCollectors('all', today)
  const q = useAccountabilitySummary(collectorId, month)
  const form = lguConfig.reports
  const cell = (r: { from: string; to: string; qty: number } | null) =>
    r ? (
      <>
        <td className="num">{r.from}</td>
        <td className="num">{r.to}</td>
        <td className="num text-right">{r.qty}</td>
      </>
    ) : (
      <>
        <td />
        <td />
        <td />
      </>
    )
  return (
    <>
      <PrintBar backLabel="Back to accountable forms">
        <NativeSelect aria-label="Collector" value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className="h-8 w-48">
          {collectors.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </NativeSelect>
        <Input aria-label="Month" type="month" value={month} max={monthKey(today)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-40" />
      </PrintBar>
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.isError || !q.data ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <DocumentPage
          title={form.accountabilityFormTitle}
          subtitle={`${form.accountabilityFormCode} · ${formatMonth(month)}`}
          meta={[
            { label: 'Accountable officer', value: `${q.data.collector.fullName} (${q.data.collector.code})` },
            { label: 'Designation', value: 'Market Collector' },
            { label: 'Period', value: formatMonth(month) },
            { label: 'Assignment', value: q.data.collector.sectionNames.join(', ') },
          ]}
          signatures={[
            { role: 'Certified correct', name: q.data.collector.fullName, title: 'Market Collector' },
            { role: 'Verified', name: '', title: lguConfig.treasurerTitle },
          ]}
        >
          <DocTable className="text-[11.5px]">
            <thead>
              <tr>
                <th rowSpan={2}>Form</th>
                <th colSpan={3} className="text-center">
                  Beginning balance
                </th>
                <th colSpan={3} className="text-center">
                  Received
                </th>
                <th colSpan={3} className="text-center">
                  Issued (used)
                </th>
                <th colSpan={3} className="text-center">
                  Ending balance
                </th>
              </tr>
              <tr>
                {Array.from({ length: 4 }).flatMap((_, i) => [
                  <th key={`f${i}`}>From</th>,
                  <th key={`t${i}`}>To</th>,
                  <th key={`q${i}`} className="text-right">
                    Qty
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {q.data.rows.length ? (
                q.data.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.formType === 'af51' ? 'AF 51' : 'Cash Ticket'}</td>
                    {cell(r.beginning)}
                    {cell(r.received[0] ?? null)}
                    {cell(r.issued)}
                    {cell(r.ending)}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13}>No accountable forms held during this period.</td>
                </tr>
              )}
            </tbody>
          </DocTable>
          {q.data.alerts.length ? (
            <>
              <h2 className="mt-6 mb-2 text-[13px] font-bold uppercase">Exceptions</h2>
              <DocTable>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Exception</th>
                    <th>Serial</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.alerts.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDate(a.date)}</td>
                      <td>{{ gap: 'Skipped', duplicate: 'Duplicate', out_of_order: 'Out of order', missing: 'Missing' }[a.kind]}</td>
                      <td className="num">{a.serial}</td>
                      <td>{a.note}</td>
                    </tr>
                  ))}
                </tbody>
              </DocTable>
            </>
          ) : null}
        </DocumentPage>
      )}
    </>
  )
}
