'use client'

import { lguConfig, marketName } from '@/config/lgu'
import { t } from '@/i18n'
import { formatDate } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import type { DemandNoticeView } from '@/types'
import { DocumentPage } from './document-page'

const BODY: Record<DemandNoticeView['level'], (n: DemandNoticeView) => string> = {
  first: (n) =>
    `Our records show that your account for Stall ${n.stallCode} has an unpaid balance of ${formatPeso(n.amountDue)}, which is now overdue. We kindly ask you to settle this amount on or before ${formatDate(n.dueBy)} to avoid further surcharges.`,
  second: (n) =>
    `This is our second notice. Despite our earlier reminder, your account for Stall ${n.stallCode} remains unpaid in the amount of ${formatPeso(n.amountDue)}. Please settle in full or visit the Market Office to agree on a payment schedule on or before ${formatDate(n.dueBy)}.`,
  final: (n) =>
    `FINAL DEMAND. Your account for Stall ${n.stallCode} remains unpaid in the amount of ${formatPeso(n.amountDue)} despite previous notices. Failure to settle on or before ${formatDate(n.dueBy)} will constrain this Office to recommend the cancellation of your lease and the repossession of the stall, without prejudice to legal action for collection.`,
}

export function DemandNoticeDoc({ n }: { n: DemandNoticeView }) {
  return (
    <DocumentPage
      title={`${t.noticeLevel[n.level]} — Demand for Payment`}
      subtitle={`Notice No. ${n.noticeNo}`}
      meta={[
        { label: 'Date issued', value: formatDate(n.issuedOn) },
        { label: 'Pay on or before', value: <strong>{formatDate(n.dueBy)}</strong> },
        { label: 'Stall', value: `${n.stallCode} · ${marketName(n.marketId, true)}, ${n.sectionName}` },
        { label: 'Amount due', value: <strong className="num">{formatPeso(n.amountDue)}</strong> },
      ]}
      signatures={[{ role: 'Very truly yours,', name: n.issuedByName, title: lguConfig.treasurerTitle }, { role: 'Received by (lessee or representative), date', name: '' }]}
      notOfficialReceipt
      footnote="If you have already paid, please disregard this notice and present your official receipt at the Market Office."
    >
      <p>
        <strong>{n.lesseeName}</strong>
        <br />
        {n.lesseeAddress}
      </p>
      <p className="mt-4">Dear {n.lesseeName.split(' ')[0]}:</p>
      <p className="mt-3">{BODY[n.level](n)}</p>
      <p className="mt-3">
        Payments may be made at the {lguConfig.officeName}, {lguConfig.officeAddress}, or with your assigned market collector, who will issue an official receipt. Unpaid rentals continue to incur the surcharge provided by ordinance.
      </p>
    </DocumentPage>
  )
}
