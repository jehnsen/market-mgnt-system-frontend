import type { Centavos, ISODate, ISODateTime } from './common'

export type SectionCategory =
  | 'fish'
  | 'meat'
  | 'vegetables'
  | 'dry_goods'
  | 'eateries'
  | 'others'
  | 'transient'

export interface MapZone {
  id: string
  label: string
  kind: 'entrance' | 'facility' | 'aisle'
  x: number
  y: number
  w: number
  h: number
}

export interface Market {
  id: string
  name: string
  shortName: string
  gridCols: number
  gridRows: number
  zones: MapZone[]
}

export interface Section {
  id: string
  marketId: string
  name: string
  category: SectionCategory
  codePrefix: string
  /** Grid origin and size (in tiles). A transient area has no stalls. */
  x: number
  y: number
  cols: number
  rows: number
  /** Number of stalls; 0 for a transient sellers' area. */
  stallCount: number
  /** Numbering offset so split sections can continue a series. */
  numberOffset?: number
}

export type StallType = 'standard' | 'corner' | 'cold' | 'eatery' | 'kiosk'

export type StallStatus = 'occupied' | 'vacant' | 'reserved' | 'under_repair'

export interface Stall {
  id: string
  code: string
  marketId: string
  sectionId: string
  sizeSqm: number
  type: StallType
  status: StallStatus
  gridX: number
  gridY: number
  currentLeaseId: string | null
  vacantSince: ISODate | null
}

export interface StallStatusChange {
  id: string
  stallId: string
  from: StallStatus | null
  to: StallStatus
  at: ISODateTime
  byName: string
  note: string
}

export interface StallDocument {
  id: string
  stallId: string | null
  lesseeId: string | null
  name: string
  kind: 'lease_contract' | 'id' | 'permit' | 'notice' | 'photo' | 'other'
  uploadedAt: ISODateTime
  sizeKb: number
}

/** Stall plus derived fields the UI needs everywhere. */
export interface StallView extends Stall {
  sectionName: string
  sectionCategory: SectionCategory
  lesseeId: string | null
  lesseeName: string | null
  monthlyRate: Centavos | null
  balance: Centavos
  leaseEnd: ISODate | null
  leaseExpiringSoon: boolean
  inArrears: boolean
  daysVacant: number | null
}

export interface Lessee {
  id: string
  firstName: string
  middleInitial: string
  lastName: string
  fullName: string
  businessName: string | null
  contactNumber: string
  email: string | null
  address: string
  smsConsent: boolean
  smsConsentAt: ISODateTime | null
  registeredOn: ISODate
  notes: string | null
}

export interface LesseeView extends Lessee {
  stallCodes: string[]
  stallIds: string[]
  balance: Centavos
  oldestUnpaidMonth: string | null
  leaseStatus: 'active' | 'expiring' | 'expired' | 'none'
}

export type LeaseStatus = 'active' | 'expired' | 'terminated'

export interface Lease {
  id: string
  leaseNo: string
  stallId: string
  lesseeId: string
  startDate: ISODate
  endDate: ISODate
  termMonths: number
  monthlyRate: Centavos
  deposit: Centavos
  status: LeaseStatus
  feeScheduleVersionId: string
  feeRateId: string
  specialConditions: string
  createdAt: ISODateTime
  createdByName: string
  renewedFromLeaseId: string | null
  terminatedOn: ISODate | null
  terminationReason: string | null
}

export interface LeaseView extends Lease {
  stallCode: string
  marketId: string
  sectionId: string
  sectionName: string
  lesseeName: string
  daysToExpiry: number
  balance: Centavos
}
