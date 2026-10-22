'use client'

import { lguConfig, marketName } from '@/config/lgu'
import { AGING_ORDER } from '@/components/finance/aging-bar'
import { t } from '@/i18n'
import { formatDate } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import type { StatementOfAccount } from '@/types'
import { DocTable, DocumentPage } from './document-page'

/** Statement of account in official form layout. Always says it is not an official receipt. */
export function StatementDoc({ s }: { s: StatementOfAccount }) {
  return (
    <DocumentPage
      title="Statement of Account"
      subtitle={`As of ${formatDate(s.asOf)}`}
      meta={[
        { label: 'Lessee', value: s.lesseeName },
        { label: 'Address', value: s.address },
        { label: 'Stall(s)', value: s.stalls.map((x) => `${x.code} (${marketName(x.marketId, true)}, ${x.sectionName})`).join('; ') || 'No active stall' },
        { label: 'Lease no.', value: s.stalls.map((x) => x.leaseNo).join(', ') || '—' },
        { label: 'Period covered', value: `${formatDate(s.periodFrom)} – ${formatDate(s.asOf)}` },
        { label: 'Amount due', value: <strong className="num">{formatPeso(s.closingBalance)}</strong> },
      ]}
      notOfficialReceipt
      signatures={[{ role: 'Prepared by', name: '', title: `for the ${lguConfig.treasurerTitle}` }]}
      footnote={<>Please settle at the {lguConfig.officeName} or with your assigned market collector, who will issue an official receipt. Unpaid rentals incur the surcharge provided by ordinance.</>}
    >
      <DocTable className="text-[12px]">
        <thead>
          <tr>
            <th>Date</th>
            <th>Particulars</th>
            <th>Reference</th>
            <th className="text-right">Charges</th>
            <th className="text-right">Payments</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{formatDate(s.periodFrom)}</td>
            <td colSpan={4}>Opening balance</td>
            <td className="num text-right">{formatPeso(s.openingBalance)}</td>
          </tr>
          {s.lines.map((l, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap">{formatDate(l.date)}</td>
              <td>{l.description}</td>
              <td className="num">{l.reference}</td>
              <td className="num text-right">{l.charge ? formatPeso(l.charge) : ''}</td>
              <td className="num text-right">{l.payment ? formatPeso(l.payment) : ''}</td>
              <td className="num text-right">{formatPeso(l.balance)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={3}>Totals / balance due</td>
            <td className="num text-right">{formatPeso(s.totalCharges)}</td>
            <td className="num text-right">{formatPeso(s.totalPayments)}</td>
            <td className="num text-right">{formatPeso(s.closingBalance)}</td>
          </tr>
        </tbody>
      </DocTable>
      <h2 className="mt-5 mb-2 text-[13px] font-bold uppercase">Aging of balance</h2>
      <DocTable className="text-[12px]">
        <thead>
          <tr>
            {AGING_ORDER.map((k) => (
              <th key={k} className="text-right">
                {t.aging[k]}
              </th>
            ))}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {AGING_ORDER.map((k) => (
              <td key={k} className="num text-right">
                {formatPeso(s.aging[k])}
              </td>
            ))}
            <td className="num text-right font-bold">{formatPeso(AGING_ORDER.reduce((sum, k) => sum + s.aging[k], 0))}</td>
          </tr>
        </tbody>
      </DocTable>
    </DocumentPage>
  )
}
