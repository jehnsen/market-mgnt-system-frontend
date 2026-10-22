import type { Centavos } from '@/types'

/**
 * Money is always an integer count of centavos. These helpers are the only
 * place amounts are converted to or from text. No floating-point arithmetic
 * is ever applied to money.
 */

const MINUS = '−'

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function assertCentavos(n: number): Centavos {
  if (!Number.isSafeInteger(n)) throw new Error(`Not an integer centavo amount: ${n}`)
  return n
}

/** ₱1,234.50 · −₱1,234.50 */
export function formatPeso(
  amount: Centavos,
  opts: { sign?: 'auto' | 'always'; symbol?: boolean; dropZeroCents?: boolean } = {},
): string {
  const { sign = 'auto', symbol = true, dropZeroCents = false } = opts
  const abs = Math.abs(amount)
  const pesos = Math.floor(abs / 100)
  const cents = abs % 100
  const body = `${symbol ? '₱' : ''}${groupThousands(pesos)}${dropZeroCents && cents === 0 ? '' : `.${String(cents).padStart(2, '0')}`}`
  if (amount < 0) return `${MINUS}${body}`
  if (sign === 'always' && amount > 0) return `+${body}`
  return body
}

/** ₱1.2M · ₱45K · ₱820 — for chart axes and KPI subtitles only. */
export function formatPesoCompact(amount: Centavos): string {
  const neg = amount < 0
  const pesos = Math.abs(amount) / 100
  let out: string
  if (pesos >= 1_000_000) out = `₱${(pesos / 1_000_000).toFixed(pesos >= 10_000_000 ? 1 : 2)}M`
  else if (pesos >= 1_000) out = `₱${(pesos / 1_000).toFixed(pesos >= 100_000 ? 0 : 1)}K`
  else out = `₱${Math.round(pesos)}`
  return neg ? `${MINUS}${out}` : out
}

/** Plain number for CSV export: 1234.50 */
export function formatPesoPlain(amount: Centavos): string {
  const abs = Math.abs(amount)
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
  return amount < 0 ? `-${s}` : s
}

/** Parse user input like "1,234.5" or "₱800" into centavos without floats. */
export function parsePeso(input: string): Centavos | null {
  const cleaned = input.replace(/[₱,\s]/g, '')
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return null
  const neg = cleaned.startsWith('-')
  const [whole = '0', frac = ''] = cleaned.replace('-', '').split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return null
  return neg ? -cents : cents
}

/** Centavos to an editable input string: 1234.50 */
export function toPesoInput(amount: Centavos): string {
  return formatPesoPlain(amount)
}

export function sum(amounts: readonly Centavos[]): Centavos {
  let total = 0
  for (const a of amounts) total += a
  return total
}

export function sumBy<T>(items: readonly T[], pick: (item: T) => Centavos): Centavos {
  let total = 0
  for (const item of items) total += pick(item)
  return total
}

/** Apply a rate in basis points (200 = 2%), rounding half away from zero to the centavo. */
export function applyBps(amount: Centavos, bps: number): Centavos {
  const product = amount * bps
  const q = Math.trunc(product / 10_000)
  const r = product - q * 10_000
  if (Math.abs(r) * 2 >= 10_000) return q + Math.sign(product)
  return q
}

export function pesos(whole: number): Centavos {
  return assertCentavos(whole * 100)
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}
