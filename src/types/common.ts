/** Integer number of centavos (₱1.00 = 100). Never a float. */
export type Centavos = number

/** Calendar date in the LGU timezone, `yyyy-MM-dd`. */
export type ISODate = string

/** Month key, `yyyy-MM`. */
export type MonthKey = string

/** Absolute instant, ISO-8601 with offset. */
export type ISODateTime = string

/** 'all' or a market id. */
export type MarketScope = 'all' | string

export interface Paged<T> {
  rows: T[]
  total: number
}
