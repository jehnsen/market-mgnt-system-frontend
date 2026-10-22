import { format, formatDistanceStrict } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import type { ISODate, ISODateTime, MonthKey } from '@/types'

/**
 * All business dates are calendar days in Asia/Manila (UTC+8, no DST).
 * ISODate strings are handled with UTC arithmetic so the browser's own
 * timezone never shifts a day.
 */
export const TZ = 'Asia/Manila'
const MANILA_OFFSET = '+08:00'

export const DATE_FMT = 'MMM d, yyyy'
export const TIME_FMT = 'h:mm a'

export function todayISO(now: Date = new Date()): ISODate {
  return formatInTimeZone(now, TZ, 'yyyy-MM-dd')
}

export function nowISO(now: Date = new Date()): ISODateTime {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

/** Build an instant for a Manila wall-clock time. */
export function manilaAt(date: ISODate, hour: number, minute = 0, second = 0): ISODateTime {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  const ss = String(second).padStart(2, '0')
  return `${date}T${hh}:${mm}:${ss}${MANILA_OFFSET}`
}

function toUtc(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
}

function fromUtc(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = toUtc(date)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return fromUtc(d)
}

/** Whole days from a to b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000)
}

export function dayOfWeek(date: ISODate): number {
  return toUtc(date).getUTCDay()
}

export function monthKey(date: ISODate): MonthKey {
  return date.slice(0, 7)
}

export function addMonthKey(month: MonthKey, n: number): MonthKey {
  return monthKey(addMonths(`${month}-01`, n))
}

export function startOfMonth(month: MonthKey): ISODate {
  return `${month}-01`
}

export function endOfMonth(month: MonthKey): ISODate {
  return addDays(addMonths(`${month}-01`, 1), -1)
}

export function daysInMonth(month: MonthKey): ISODate[] {
  const out: ISODate[] = []
  let d = startOfMonth(month)
  while (monthKey(d) === month) {
    out.push(d)
    d = addDays(d, 1)
  }
  return out
}

export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return ((ty ?? 0) - (fy ?? 0)) * 12 + ((tm ?? 0) - (fm ?? 0))
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Oct 22, 2026 */
export function formatDate(value: ISODate | ISODateTime | null | undefined): string {
  if (!value) return '—'
  if (isDateOnly(value)) {
    const d = toUtc(value)
    return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), DATE_FMT)
  }
  return formatInTimeZone(value, TZ, DATE_FMT)
}

/** 7:42 AM */
export function formatTime(value: ISODateTime | null | undefined): string {
  if (!value) return '—'
  return formatInTimeZone(value, TZ, TIME_FMT)
}

/** Oct 22, 2026 7:42 AM */
export function formatDateTime(value: ISODateTime | null | undefined): string {
  if (!value) return '—'
  return formatInTimeZone(value, TZ, `${DATE_FMT} ${TIME_FMT}`)
}

/** October 2026 */
export function formatMonth(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number)
  return format(new Date(y ?? 1970, (m ?? 1) - 1, 1), 'MMMM yyyy')
}

/** Oct 2026 */
export function formatMonthShort(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number)
  return format(new Date(y ?? 1970, (m ?? 1) - 1, 1), 'MMM yyyy')
}

/** Thursday */
export function formatWeekday(date: ISODate): string {
  const d = toUtc(date)
  return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 'EEEE')
}

/** Oct 22 */
export function formatDayShort(date: ISODate): string {
  const d = toUtc(date)
  return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 'MMM d')
}

/** "14 minutes ago" */
export function formatAgo(value: ISODateTime | null | undefined, now: Date = new Date()): string {
  if (!value) return 'never'
  return `${formatDistanceStrict(new Date(value), now)} ago`
}

export function minutesSince(value: ISODateTime | null | undefined, now: Date = new Date()): number {
  if (!value) return Number.POSITIVE_INFINITY
  return Math.floor((now.getTime() - new Date(value).getTime()) / 60_000)
}

export function greeting(now: Date = new Date()): string {
  const hour = Number(formatInTimeZone(now, TZ, 'H'))
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
