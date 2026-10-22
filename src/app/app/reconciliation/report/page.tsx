'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { DocTable, DocumentPage, PrintBar } from '@/components/documents/document-page'
import { RoleGate } from '@/components/shared/role-gate'
import { ErrorState, PageSkeleton } from '@/components/shared/states'
import { NativeSelect } from '@/components/ui/input'
import { lguConfig, marketName } from '@/config/lgu'
import { useCollectors, useReportOfCollections } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatDate, formatDateTime, formatTime } from '@/lib/dates'
import { formatPeso, sumBy } from '@/lib/money'

export default function ReportOfCollectionsPage() {
  return (
    <RoleGate permission="recon.view" page="reports of collections">
      <React.Suspense>
        <Report />
      </React.Suspense>
    </RoleGate>
  )
}

function Report() {
  const params = useSearchParams()
  const { date: ctxDate } = useAppContext()
  const [collectorId, setCollectorId] = React.useState(params.get('collector') ?? 'col-01')
  const date = params.get('date') ?? ctxDate
  const collectors = useCollectors('all', date)
  const q = useReportOfCollections(collectorId, date)
  const form = lguConfig.reports

  return (
    <>
      <PrintBar backLabel="Back to reconciliation">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Collector</span>
          <NativeSelect value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className="h-8 w-48">
            {collectors.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </NativeSelect>
        </label>
      </PrintBar>
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.isError || !q.data ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <DocumentPage
          title={form.dailyCollectionFormTitle}
          subtitle={`${form.dailyCollectionFormCode} · ${marketName(q.data.collector.marketId)}`}
          meta={[
            { label: 'Collector', value: `${q.data.collector.fullName} (${q.data.collector.code})` },
            { label: 'Date', value: formatDate(date) },
            { label: 'Sections', value: q.data.collector.sectionNames.join(', ') },
            { label: 'Report no.', value: <span className="num">{`${form.dailyCollectionFormCode}-${date.replace(/-/g, '')}-${q.data.collector.code.replace('-', '')}`}</span> },
          ]}
          signatures={[
            { role: 'Certified correct', name: q.data.collector.fullName, title: 'Market Collector' },
            { role: 'Received and verified', name: q.data.row.remittances[0]?.receivedByName ?? '', title: `for the ${lguConfig.treasurerTitle}` },
          ]}
          footnote={<>{t.notices.marcisNoOr} Generated {formatDateTime(new Date().toISOString())}.</>}
        >
          <h2 className="mb-2 text-[13px] font-bold uppercase">A. Collections</h2>
          <DocTable>
            <thead>
              <tr>
                <th>Nature of collection</th>
                <th className="text-right">No. of forms</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {q.data.byType.map((b) => (
                <tr key={b.type}>
                  <td>{t.collectionType[b.type]}</td>
                  <td className="num text-right">{b.count}</td>
                  <td className="num text-right">{formatPeso(b.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td>Total collections</td>
                <td className="num text-right">{sumBy(q.data.byType, (b) => b.count)}</td>
                <td className="num text-right">{formatPeso(sumBy(q.data.byType, (b) => b.amount))}</td>
              </tr>
            </tbody>
          </DocTable>

          <h2 className="mt-6 mb-2 text-[13px] font-bold uppercase">B. Accountable forms used</h2>
          <DocTable>
            <thead>
              <tr>
                <th>Form</th>
                <th>From</th>
                <th>To</th>
                <th className="text-right">Qty</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {q.data.row.serials.map((s) => (
                <tr key={s.formType}>
                  <td>{lguConfig.accountableFormTypes.find((f) => f.id === s.formType)?.shortName ?? s.formType}</td>
                  <td className="num">{s.first}</td>
                  <td className="num">{s.last}</td>
                  <td className="num text-right">{s.count}</td>
                  <td>{[s.gaps.length ? `Skipped: ${s.gaps.join(', ')}` : '', s.duplicates.length ? `Duplicate: ${s.duplicates.join(', ')}` : ''].filter(Boolean).join('; ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </DocTable>

          <h2 className="mt-6 mb-2 text-[13px] font-bold uppercase">C. Remittance / deposit</h2>
          <DocTable>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Received</th>
                <th>Received by</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {q.data.row.remittances.length ? (
                q.data.row.remittances.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{r.reference}</td>
                    <td>{formatDateTime(r.receivedAt)}</td>
                    <td>{r.receivedByName}</td>
                    <td className="num text-right">{formatPeso(r.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No remittance recorded yet.</td>
                </tr>
              )}
              <tr className="font-bold">
                <td colSpan={3}>Variance (remitted less collections)</td>
                <td className="num text-right">{q.data.row.remittances.length ? formatPeso(q.data.row.variance, { sign: 'always' }) : '—'}</td>
              </tr>
            </tbody>
          </DocTable>

          <h2 className="mt-6 mb-2 text-[13px] font-bold uppercase">D. Detail of collections</h2>
          <DocTable className="text-[11.5px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Serial</th>
                <th>Payer</th>
                <th>Nature</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {q.data.collections.map((c) => (
                <tr key={c.id}>
                  <td>{formatTime(c.recordedAt)}</td>
                  <td className="num">
                    {c.formType === 'af51' ? 'OR' : 'CT'} {c.receiptSerial}
                  </td>
                  <td>{c.correctsCollectionId ? `Correction (${c.correctionStatus})` : `${c.stallCode ? `${c.stallCode} · ` : ''}${c.payerName}`}</td>
                  <td>{t.collectionType[c.type]}</td>
                  <td className="num text-right">{c.correctsCollectionId && c.correctionStatus !== 'approved' ? `(${formatPeso(c.amount, { sign: 'always' })})` : formatPeso(c.countedAmount)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={4}>Total</td>
                <td className="num text-right">{formatPeso(sumBy(q.data.collections, (c) => c.countedAmount))}</td>
              </tr>
            </tbody>
          </DocTable>
          <p className="mt-2 text-[11.5px] text-[#555]">Amounts in parentheses are corrections not yet approved and are not included in the total.</p>
        </DocumentPage>
      )}
    </>
  )
}
