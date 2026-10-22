'use client'

import * as React from 'react'
import { lguConfig, marketName } from '@/config/lgu'
import { addDays, addMonths, formatDate } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import type { Centavos, FeeSchedule, ISODate } from '@/types'
import { DocumentPage } from './document-page'

export interface LeaseContractData {
  leaseNo: string | null
  lesseeName: string
  lesseeAddress: string
  stallCode: string
  marketId: string
  sectionName: string
  sizeSqm: number
  startDate: ISODate
  termMonths: number
  monthlyRate: Centavos
  deposit: Centavos
  specialConditions: string
  schedule: FeeSchedule
  rateOrdinanceRef: string
}

/** Printable stall lease contract in official-document style. */
export function LeaseContract({ data, draft }: { data: LeaseContractData; draft?: boolean }) {
  const end = addDays(addMonths(data.startDate, data.termMonths), -1)
  const conditions = data.specialConditions.trim()
  return (
    <DocumentPage
      title="Contract of Lease of Market Stall"
      subtitle={draft ? 'DRAFT — for review before signing' : `Lease No. ${data.leaseNo}`}
      office={`${lguConfig.officeName} · ${marketName(data.marketId)}`}
      meta={[
        { label: 'Stall', value: <span className="num">{data.stallCode}</span> },
        { label: 'Market / section', value: `${marketName(data.marketId, true)} · ${data.sectionName}` },
        { label: 'Floor area', value: `${data.sizeSqm} square meters` },
        { label: 'Term', value: `${data.termMonths} months` },
        { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(end)}` },
        { label: 'Monthly rental', value: <span className="num">{formatPeso(data.monthlyRate)}</span> },
      ]}
      signatures={[
        { role: 'Lessor', name: 'Municipal Mayor', title: `for the ${lguConfig.municipality}` },
        { role: 'Lessee', name: data.lesseeName, title: data.lesseeAddress },
        { role: 'Recommending approval', name: lguConfig.marketSupervisorTitle },
        { role: 'Funds available / rate verified', name: lguConfig.treasurerTitle },
      ]}
      footnote={<>Rates under {data.schedule.ordinanceRef}. Penalty: {data.schedule.penaltyOrdinanceRef}.</>}
    >
      <p>
        This Contract of Lease is entered into by the <strong>{lguConfig.municipality}</strong>, {lguConfig.province}, represented by the Municipal Mayor (the <em>Lessor</em>), and{' '}
        <strong>{data.lesseeName}</strong>, of legal age, residing at {data.lesseeAddress} (the <em>Lessee</em>).
      </p>
      <ol className="mt-4 grid list-decimal gap-2.5 pl-5">
        <li>
          <strong>Premises.</strong> The Lessor leases to the Lessee Stall <span className="num">{data.stallCode}</span> in the {data.sectionName} section of the {marketName(data.marketId)}, with a floor area of {data.sizeSqm} square meters.
        </li>
        <li>
          <strong>Term.</strong> The lease runs for {data.termMonths} months, from {formatDate(data.startDate)} to {formatDate(end)}, renewable upon written application at least thirty (30) days before it ends.
        </li>
        <li>
          <strong>Rental.</strong> The Lessee shall pay a monthly rental of <span className="num">{formatPeso(data.monthlyRate)}</span> on or before the last day of each month, per {data.rateOrdinanceRef}. Payment is made to the
          Municipal Treasurer or an authorized collector against an official receipt.
        </li>
        <li>
          <strong>Surcharge.</strong> {data.schedule.penaltyRule} ({data.schedule.penaltyOrdinanceRef}.)
        </li>
        <li>
          <strong>Deposit.</strong> The Lessee pays a deposit of <span className="num">{formatPeso(data.deposit)}</span>, refundable at the end of the lease less any unpaid rentals, surcharges or damage.
        </li>
        <li>
          <strong>Use.</strong> The stall shall be used only for the lawful trade registered with the Market Office. Subleasing or transfer without the written approval of the Municipal Treasurer is a ground for cancellation.
        </li>
        <li>
          <strong>Daily fees.</strong> The Lessee shall also pay the daily market fee set by ordinance, collected by the assigned market collector against a cash ticket.
        </li>
        <li>
          <strong>Cancellation.</strong> Non-payment of rentals for three (3) consecutive months, after due notice, is a ground for cancellation of this lease and repossession of the stall.
        </li>
        {conditions ? (
          <li>
            <strong>Special conditions.</strong> {conditions}
          </li>
        ) : null}
      </ol>
      <p className="mt-4">
        Signed at {lguConfig.municipalityShort}, {lguConfig.province.replace('Province of ', '')}, on ____________________.
      </p>
    </DocumentPage>
  )
}
