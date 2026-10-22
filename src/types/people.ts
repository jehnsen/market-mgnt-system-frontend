import type { Centavos, ISODate, ISODateTime } from './common'

export type CollectorStatus = 'active' | 'suspended'

export interface Collector {
  id: string
  code: string
  firstName: string
  lastName: string
  fullName: string
  contactNumber: string
  marketId: string
  status: CollectorStatus
  deviceId: string | null
  employedSince: ISODate
  suspendedReason: string | null
}

export type DeviceStatus = 'active' | 'deactivated'

export interface Device {
  id: string
  collectorId: string | null
  label: string
  model: string
  serialNo: string
  appVersion: string
  lastSyncAt: ISODateTime
  unsyncedCount: number
  batteryPct: number
  status: DeviceStatus
  registeredOn: ISODate
  deactivatedAt: ISODateTime | null
  deactivatedReason: string | null
}

export interface DeviceEvent {
  id: string
  deviceId: string
  collectorId: string | null
  at: ISODateTime
  event: 'registered' | 'assigned' | 'app_updated' | 'deactivated' | 'unassigned'
  note: string
}

export interface Assignment {
  id: string
  collectorId: string
  marketId: string
  sectionId: string
  effectiveFrom: ISODate
  effectiveTo: ISODate | null
}

export interface CollectorView extends Collector {
  device: Device | null
  sectionIds: string[]
  sectionNames: string[]
  todayCount: number
  todayTotal: Centavos
  todayRemitted: Centavos
  todayVariance: Centavos
  lastSyncAt: ISODateTime | null
  unsyncedCount: number
  syncStale: boolean
}
