import type { LguConfig } from '@/types'

/**
 * Per-LGU deployment config. Everything that names the municipality, its
 * markets or its forms comes from here so MARCIS can be redeployed for
 * another LGU by swapping this file (and markets.ts).
 */
export const lguConfig: LguConfig = {
  country: 'Republic of the Philippines',
  region: 'Region VI – Western Visayas',
  province: 'Province of Capiz',
  municipality: 'Municipality of Pontevedra',
  municipalityShort: 'Pontevedra',
  officeName: "Municipal Treasurer's Office",
  officeAddress: 'Municipal Hall, Poblacion, Pontevedra, Capiz 5802',
  officeContact: '(036) 000-0000 · mto@pontevedra.example.gov.ph',
  sealPath: '/seal.svg',
  timezone: 'Asia/Manila',
  currency: 'PHP',
  treasurerTitle: 'Municipal Treasurer',
  marketSupervisorTitle: 'Market Supervisor',
  markets: [
    { id: 'pm', name: 'Pontevedra Public Market', shortName: 'Public Market' },
    { id: 'sm', name: 'Pontevedra Seafood Market', shortName: 'Seafood Market' },
  ],
  accountableFormTypes: [
    {
      id: 'af51',
      name: 'Official Receipt (Accountable Form No. 51)',
      shortName: 'OR (AF 51)',
      prefix: 'OR',
      serialLength: 7,
      unitsPerBooklet: 50,
    },
    {
      id: 'ct',
      name: 'Cash Ticket',
      shortName: 'Cash Ticket',
      prefix: 'CT',
      serialLength: 7,
      unitsPerBooklet: 100,
    },
  ],
  reports: {
    dailyCollectionFormTitle: 'Report of Collections and Deposits',
    dailyCollectionFormCode: 'RCD',
    accountabilityFormTitle: 'Report of Accountability for Accountable Forms',
    accountabilityFormCode: 'RAAF',
  },
  sms: {
    enabled: true,
    senderName: 'PONTEVEDRA',
    yearlyAllowance: 5000,
    warnAtPercent: 80,
  },
  features: {
    digitalPayments: false,
  },
}

export function marketName(marketId: string, short = false): string {
  const m = lguConfig.markets.find((x) => x.id === marketId)
  if (!m) return marketId
  return short ? m.shortName : m.name
}
