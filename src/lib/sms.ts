export const MERGE_FIELDS = [
  { key: 'name', label: 'Lessee name', sample: 'Elena Magbanua' },
  { key: 'stall', label: 'Stall code(s)', sample: 'FN-07' },
  { key: 'market', label: 'Market', sample: 'Seafood Market' },
  { key: 'balance', label: 'Balance due', sample: '₱3,672.00' },
  { key: 'amount', label: 'Monthly rental', sample: '₱1,800.00' },
  { key: 'month', label: 'Billing month', sample: 'October 2026' },
  { key: 'due_date', label: 'Due date', sample: 'Oct 31, 2026' },
  { key: 'lease_end', label: 'Lease end date', sample: 'Nov 15, 2026' },
  { key: 'as_of', label: 'As-of date', sample: 'Oct 22, 2026' },
] as const

export type MergeKey = (typeof MERGE_FIELDS)[number]['key']
export type MergeVars = Partial<Record<MergeKey, string>>

export function renderTemplate(body: string, vars: MergeVars): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => {
    const v = vars[key as MergeKey]
    return v ?? match
  })
}

/** Billing units: 160 GSM characters per single message, 153 per part when longer. */
export function smsUnits(text: string): number {
  if (text.length <= 160) return 1
  return Math.ceil(text.length / 153)
}

export function sampleVars(): MergeVars {
  const out: MergeVars = {}
  for (const f of MERGE_FIELDS) out[f.key] = f.sample
  return out
}
