import type { Market, Section, StallType } from '@/types'
import { lguConfig } from './lgu'

/**
 * Schematic floor plans. Each section is a rectangular block of stall tiles on
 * a grid; the map renders one tile per stall. Positions are in tile units.
 * Edit here (or via Settings → Markets, sections and stalls) to match the
 * actual building.
 */

const marketName = (id: string) => lguConfig.markets.find((m) => m.id === id)

export const markets: Market[] = [
  {
    id: 'pm',
    name: marketName('pm')?.name ?? 'Public Market',
    shortName: marketName('pm')?.shortName ?? 'Public Market',
    gridCols: 25,
    gridRows: 15,
    zones: [
      { id: 'pm-entrance', label: 'Main entrance', kind: 'entrance', x: 10, y: 14, w: 5, h: 1 },
      { id: 'pm-office', label: 'Market office', kind: 'facility', x: 14, y: 10, w: 4, h: 2 },
      { id: 'pm-cr', label: 'Comfort rooms', kind: 'facility', x: 19, y: 10, w: 3, h: 2 },
      { id: 'pm-side', label: 'Side entrance', kind: 'entrance', x: 24, y: 4, w: 1, h: 3 },
    ],
  },
  {
    id: 'sm',
    name: marketName('sm')?.name ?? 'Seafood Market',
    shortName: marketName('sm')?.shortName ?? 'Seafood Market',
    gridCols: 22,
    gridRows: 13,
    zones: [
      { id: 'sm-landing', label: 'Fish landing (wharf side)', kind: 'entrance', x: 6, y: 12, w: 10, h: 1 },
      { id: 'sm-weigh', label: 'Weighing station', kind: 'facility', x: 12, y: 6, w: 4, h: 1 },
      { id: 'sm-office', label: 'Office', kind: 'facility', x: 17, y: 6, w: 4, h: 1 },
    ],
  },
]

export const sections: Section[] = [
  // Public Market — 110 stalls
  { id: 'pm-meat', marketId: 'pm', name: 'Meat', category: 'meat', codePrefix: 'M', x: 1, y: 1, cols: 10, rows: 2, stallCount: 20 },
  { id: 'pm-dry', marketId: 'pm', name: 'Dry Goods', category: 'dry_goods', codePrefix: 'D', x: 14, y: 1, cols: 10, rows: 3, stallCount: 30 },
  { id: 'pm-veg', marketId: 'pm', name: 'Vegetables', category: 'vegetables', codePrefix: 'V', x: 1, y: 5, cols: 10, rows: 3, stallCount: 30 },
  { id: 'pm-eat', marketId: 'pm', name: 'Eateries', category: 'eateries', codePrefix: 'E', x: 14, y: 6, cols: 7, rows: 2, stallCount: 14 },
  { id: 'pm-oth', marketId: 'pm', name: 'Others', category: 'others', codePrefix: 'O', x: 1, y: 10, cols: 8, rows: 2, stallCount: 16 },
  // Seafood Market — 60 stalls + transient area
  { id: 'sm-fn', marketId: 'sm', name: 'Fish – North wing', category: 'fish', codePrefix: 'FN', x: 1, y: 1, cols: 9, rows: 3, stallCount: 27 },
  { id: 'sm-fs', marketId: 'sm', name: 'Fish – South wing', category: 'fish', codePrefix: 'FS', x: 12, y: 1, cols: 9, rows: 3, stallCount: 27 },
  { id: 'sm-oth', marketId: 'sm', name: 'Ice & Supplies', category: 'others', codePrefix: 'S', x: 1, y: 6, cols: 6, rows: 1, stallCount: 6 },
  { id: 'sm-tr', marketId: 'sm', name: "Transient sellers' area", category: 'transient', codePrefix: 'T', x: 1, y: 8, cols: 20, rows: 3, stallCount: 0 },
]

export interface StallLayout {
  id: string
  code: string
  marketId: string
  sectionId: string
  gridX: number
  gridY: number
  type: StallType
  sizeSqm: number
}

const SIZE: Record<StallType, number> = { standard: 4, corner: 6, cold: 6, eatery: 9, kiosk: 3 }

function typeFor(section: Section, col: number, row: number): StallType {
  if (section.category === 'eateries') return 'eatery'
  if (section.category === 'others') return 'kiosk'
  if (section.category === 'meat' && row === 0) return 'cold'
  if (col === 0 || col === section.cols - 1) return 'corner'
  return 'standard'
}

/** Expand section blocks into stall tiles, numbered row by row. */
export function buildStallLayout(): StallLayout[] {
  const out: StallLayout[] = []
  for (const s of sections) {
    if (s.stallCount === 0) continue
    let n = 0
    for (let row = 0; row < s.rows; row++) {
      for (let col = 0; col < s.cols; col++) {
        if (n >= s.stallCount) break
        n++
        const code = `${s.codePrefix}-${String(n + (s.numberOffset ?? 0)).padStart(2, '0')}`
        const type = typeFor(s, col, row)
        out.push({
          id: `${s.marketId}-${code}`.toLowerCase(),
          code,
          marketId: s.marketId,
          sectionId: s.id,
          gridX: s.x + col,
          gridY: s.y + row,
          type,
          sizeSqm: SIZE[type],
        })
      }
    }
  }
  return out
}

export const SECTION_CATEGORY_LABEL: Record<Section['category'], string> = {
  fish: 'Fish',
  meat: 'Meat',
  vegetables: 'Vegetables',
  dry_goods: 'Dry Goods',
  eateries: 'Eateries',
  others: 'Others',
  transient: 'Transient',
}
