'use client'

import * as React from 'react'
import { MinusIcon, PlusIcon, ScanIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { formatDate } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Market, Section, StallStatus, StallView } from '@/types'

const CELL = 44
const GAP = 5
const PAD = 22
const pos = (n: number) => PAD + n * (CELL + GAP)

const STATUS_STYLE: Record<StallStatus, { fill: string; stroke: string; text: string; letter: string | null; dash?: string }> = {
  occupied: { fill: 'var(--st-occupied)', stroke: 'var(--st-occupied)', text: 'var(--primary-ink)', letter: null },
  vacant: { fill: 'var(--surface)', stroke: 'var(--st-vacant)', text: 'var(--ink-muted)', letter: 'V', dash: '4 3' },
  reserved: { fill: 'var(--st-reserved)', stroke: 'var(--st-reserved)', text: '#ffffff', letter: 'R' },
  under_repair: { fill: 'color-mix(in oklab, var(--st-repair) 22%, var(--surface))', stroke: 'var(--st-repair)', text: 'var(--ink)', letter: 'U' },
}

export function stallAriaLabel(s: StallView) {
  const parts = [`Stall ${s.code}`, s.sectionName, t.stallStatus[s.status]]
  if (s.lesseeName) parts.push(`lessee ${s.lesseeName}`)
  if (s.monthlyRate) parts.push(`rate ${formatPeso(s.monthlyRate)} a month`)
  if (s.balance > 0) parts.push(`balance ${formatPeso(s.balance)}`)
  if (s.inArrears) parts.push('in arrears')
  if (s.leaseExpiringSoon && s.leaseEnd) parts.push(`lease ends ${formatDate(s.leaseEnd)}`)
  return parts.join(', ')
}

interface StallMapProps {
  market: Market
  sections: Section[]
  stalls: StallView[]
  /** Stall ids that match the active filters; others are dimmed. */
  matches?: Set<string> | null
  selectedId?: string | null
  onSelect?: (stall: StallView) => void
  /** Grid editor mode: clicking an empty tile reports it. */
  onEmptyCell?: (x: number, y: number) => void
  height?: number
  className?: string
}

export function StallMap({ market, sections, stalls, matches, selectedId, onSelect, onEmptyCell, height = 460, className }: StallMapProps) {
  const width = PAD * 2 + market.gridCols * (CELL + GAP) - GAP
  const fullHeight = PAD * 2 + market.gridRows * (CELL + GAP) - GAP + 14
  const [view, setView] = React.useState({ scale: 1, x: 0, y: 0 })
  const [focusId, setFocusId] = React.useState<string | null>(null)
  const [hover, setHover] = React.useState<{ stall: StallView; left: number; top: number } | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tileRefs = React.useRef(new Map<string, SVGGElement>())
  const drag = React.useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)

  const byPos = React.useMemo(() => new Map(stalls.map((s) => [`${s.gridX},${s.gridY}`, s])), [stalls])
  const sorted = React.useMemo(() => [...stalls].sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX), [stalls])
  const tabStop = selectedId && stalls.some((s) => s.id === selectedId) ? selectedId : (focusId ?? sorted[0]?.id ?? null)

  // Fit to width on first render.
  const fit = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const scale = Math.min(1, el.clientWidth / width, el.clientHeight / fullHeight)
    setView({ scale, x: (el.clientWidth - width * scale) / 2, y: (el.clientHeight - fullHeight * scale) / 2 })
  }, [width, fullHeight])
  React.useEffect(() => {
    fit()
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => fit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  const zoom = (factor: number) => {
    const el = containerRef.current
    setView((v) => {
      const scale = Math.min(3, Math.max(0.35, v.scale * factor))
      const cx = (el?.clientWidth ?? width) / 2
      const cy = (el?.clientHeight ?? height) / 2
      return { scale, x: cx - ((cx - v.x) * scale) / v.scale, y: cy - ((cy - v.y) * scale) / v.scale }
    })
  }

  const moveFocus = (from: StallView, dx: number, dy: number) => {
    // Nearest stall in the pressed direction, preferring the same row/column.
    let best: StallView | null = null
    let bestScore = Infinity
    for (const s of stalls) {
      const ddx = s.gridX - from.gridX
      const ddy = s.gridY - from.gridY
      if (dx !== 0 && Math.sign(ddx) !== dx) continue
      if (dy !== 0 && Math.sign(ddy) !== dy) continue
      if (dx !== 0 && ddx === 0) continue
      if (dy !== 0 && ddy === 0) continue
      const primary = dx !== 0 ? Math.abs(ddx) : Math.abs(ddy)
      const secondary = dx !== 0 ? Math.abs(ddy) : Math.abs(ddx)
      const score = primary + secondary * 3
      if (score < bestScore) {
        bestScore = score
        best = s
      }
    }
    if (best) {
      setFocusId(best.id)
      tileRefs.current.get(best.id)?.focus()
      ensureVisible(best)
    }
  }

  const ensureVisible = (s: StallView) => {
    const el = containerRef.current
    if (!el) return
    const tx = pos(s.gridX) * view.scale + view.x
    const ty = pos(s.gridY) * view.scale + view.y
    const size = CELL * view.scale
    let { x, y } = view
    if (tx < 8) x += 8 - tx
    if (tx + size > el.clientWidth - 8) x -= tx + size - (el.clientWidth - 8)
    if (ty < 8) y += 8 - ty
    if (ty + size > el.clientHeight - 8) y -= ty + size - (el.clientHeight - 8)
    if (x !== view.x || y !== view.y) setView({ ...view, x, y })
  }

  const onKey = (e: React.KeyboardEvent, s: StallView) => {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const d = dirs[e.key]
    if (d) {
      e.preventDefault()
      moveFocus(s, d[0], d[1])
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(s)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const target = e.key === 'Home' ? sorted[0] : sorted[sorted.length - 1]
      if (target) {
        setFocusId(target.id)
        tileRefs.current.get(target.id)?.focus()
      }
    }
  }

  const showHover = (s: StallView, target: Element) => {
    const box = containerRef.current?.getBoundingClientRect()
    const r = target.getBoundingClientRect()
    if (!box) return
    setHover({ stall: s, left: r.left - box.left + r.width / 2, top: r.top - box.top })
  }

  const sectionBoxes = sections.map((sec) => {
    const mine = stalls.filter((s) => s.sectionId === sec.id)
    if (mine.length === 0) return { sec, x0: sec.x, y0: sec.y, x1: sec.x + sec.cols - 1, y1: sec.y + sec.rows - 1, empty: true }
    return {
      sec,
      x0: Math.min(...mine.map((s) => s.gridX)),
      y0: Math.min(...mine.map((s) => s.gridY)),
      x1: Math.max(...mine.map((s) => s.gridX)),
      y1: Math.max(...mine.map((s) => s.gridY)),
      empty: false,
    }
  })

  return (
    <div className={cn('relative', className)}>
      <div className="no-print absolute top-2 right-2 z-10 flex flex-col gap-1 rounded-md border border-border bg-surface/95 p-1 shadow-sm">
        <Button variant="ghost" size="icon-sm" onClick={() => zoom(1.25)} aria-label="Zoom in">
          <PlusIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => zoom(0.8)} aria-label="Zoom out">
          <MinusIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={fit} aria-label="Fit floor plan to view">
          <ScanIcon />
        </Button>
      </div>
      <div
        ref={containerRef}
        className="relative w-full touch-none overflow-hidden rounded-md bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] select-none"
        style={{ height }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[data-tile]')) return
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }
          ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          const dy = e.clientY - d.y
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
          setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }))
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return
          e.preventDefault()
          zoom(e.deltaY < 0 ? 1.1 : 0.9)
        }}
      >
        <svg width={width} height={fullHeight} role="group" aria-label={`Floor plan of ${market.name}. Use arrow keys to move between stalls and Enter to open one.`} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }} className="absolute top-0 left-0 max-w-none overflow-visible">
          <defs>
            <pattern id={`repair-${market.id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--st-repair)" strokeWidth="1.5" opacity="0.45" />
            </pattern>
          </defs>
          <rect x={4} y={4} width={width - 8} height={fullHeight - 8} rx={10} fill="var(--surface)" stroke="var(--border-strong)" strokeWidth={1.5} />

          {market.zones.map((z) => (
            <g key={z.id} aria-hidden>
              <rect x={pos(z.x)} y={pos(z.y)} width={z.w * (CELL + GAP) - GAP} height={z.h * (CELL + GAP) - GAP} rx={6} fill={z.kind === 'entrance' ? 'var(--accent-soft)' : 'var(--surface-muted)'} stroke={z.kind === 'entrance' ? 'var(--accent)' : 'var(--border-strong)'} strokeDasharray="5 4" />
              <text
                x={pos(z.x) + (z.w * (CELL + GAP) - GAP) / 2}
                y={pos(z.y) + (z.h * (CELL + GAP) - GAP) / 2 + 4}
                transform={z.h > z.w ? `rotate(-90 ${pos(z.x) + (z.w * (CELL + GAP) - GAP) / 2} ${pos(z.y) + (z.h * (CELL + GAP) - GAP) / 2})` : undefined}
                textAnchor="middle"
                fontSize={11}
                fill="var(--ink-muted)"
                fontWeight={500}
              >
                {z.label}
              </text>
            </g>
          ))}

          {sectionBoxes.map(({ sec, x0, y0, x1, y1, empty }) => {
            const x = pos(x0) - 6
            const y = pos(y0) - 6
            const w = (x1 - x0 + 1) * (CELL + GAP) - GAP + 12
            const h = (y1 - y0 + 1) * (CELL + GAP) - GAP + 12
            return (
              <g key={sec.id} aria-hidden>
                <rect x={x} y={y} width={w} height={h} rx={8} fill={empty ? 'var(--surface-muted)' : 'none'} stroke="var(--border)" strokeWidth={1} strokeDasharray={empty ? '6 4' : undefined} />
                <text x={x + 2} y={y - 5} fontSize={11.5} fontWeight={600} fill="var(--ink-muted)" letterSpacing="0.04em">
                  {sec.name.toUpperCase()}
                </text>
                {empty ? (
                  <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={12} fill="var(--ink-muted)">
                    Open area · transient sellers pay per day
                  </text>
                ) : null}
              </g>
            )
          })}

          {onEmptyCell
            ? Array.from({ length: market.gridCols * market.gridRows }, (_, i) => {
                const gx = i % market.gridCols
                const gy = Math.floor(i / market.gridCols)
                if (byPos.has(`${gx},${gy}`)) return null
                return (
                  <rect
                    key={i}
                    x={pos(gx)}
                    y={pos(gy)}
                    width={CELL}
                    height={CELL}
                    rx={5}
                    fill="transparent"
                    stroke="var(--border)"
                    strokeOpacity={0.6}
                    className="cursor-cell hover:fill-[var(--primary-soft)]"
                    onClick={() => onEmptyCell(gx, gy)}
                    aria-hidden
                  />
                )
              })
            : null}

          {stalls.map((s) => {
            const st = STATUS_STYLE[s.status]
            const x = pos(s.gridX)
            const y = pos(s.gridY)
            const dim = matches ? !matches.has(s.id) : false
            const selected = s.id === selectedId
            const focused = s.id === focusId
            return (
              <g
                key={s.id}
                data-tile
                ref={(el) => {
                  if (el) tileRefs.current.set(s.id, el)
                  else tileRefs.current.delete(s.id)
                }}
                role="button"
                tabIndex={s.id === tabStop ? 0 : -1}
                aria-label={stallAriaLabel(s)}
                aria-pressed={selected}
                onClick={() => onSelect?.(s)}
                onKeyDown={(e) => onKey(e, s)}
                onFocus={(e) => {
                  setFocusId(s.id)
                  showHover(s, e.currentTarget)
                }}
                onBlur={() => setHover(null)}
                onPointerEnter={(e) => showHover(s, e.currentTarget)}
                onPointerLeave={() => setHover(null)}
                className="cursor-pointer outline-none"
                opacity={dim ? 0.22 : 1}
              >
                <rect x={x} y={y} width={CELL} height={CELL} rx={6} fill={st.fill} stroke={st.stroke} strokeWidth={1.5} strokeDasharray={st.dash} />
                {s.status === 'under_repair' ? <rect x={x} y={y} width={CELL} height={CELL} rx={6} fill={`url(#repair-${market.id})`} /> : null}
                <text x={x + CELL / 2} y={y + CELL / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={st.text} fontFamily="var(--font-mono)">
                  {s.code}
                </text>
                {st.letter ? (
                  <text x={x + CELL - 5} y={y + CELL - 5} textAnchor="end" fontSize={9} fontWeight={700} fill={st.text} opacity={0.85}>
                    {st.letter}
                  </text>
                ) : null}
                {s.inArrears ? <rect x={x + 4} y={y + 4} width={7} height={7} rx={1} fill="var(--st-arrears)" stroke="var(--surface)" strokeWidth={1.5} /> : null}
                {s.leaseExpiringSoon ? <circle cx={x + CELL - 7.5} cy={y + 7.5} r={4} fill="var(--st-expiring)" stroke="var(--surface)" strokeWidth={1.5} /> : null}
                {selected || focused ? <rect x={x - 3.5} y={y - 3.5} width={CELL + 7} height={CELL + 7} rx={8} fill="none" stroke={selected ? 'var(--accent)' : 'var(--focus)'} strokeWidth={2.5} /> : null}
              </g>
            )
          })}
        </svg>
        {hover ? (
          <div role="tooltip" className="pointer-events-none absolute z-20 w-56 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-surface-raised px-3 py-2 text-[13px] shadow-pop" style={{ left: hover.left, top: hover.top - 8 }}>
            <p className="flex items-center justify-between gap-2">
              <span className="num font-semibold">{hover.stall.code}</span>
              <span className="text-xs text-ink-muted">{t.stallStatus[hover.stall.status]}</span>
            </p>
            <p className="truncate">{hover.stall.lesseeName ?? <span className="text-ink-muted">No lessee</span>}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-2 text-xs">
              <dt className="text-ink-muted">Monthly rate</dt>
              <dd className="num text-right">{hover.stall.monthlyRate ? formatPeso(hover.stall.monthlyRate) : '—'}</dd>
              <dt className="text-ink-muted">Balance</dt>
              <dd className={cn('num text-right', hover.stall.inArrears && 'font-semibold text-money-short')}>{formatPeso(hover.stall.balance)}</dd>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function StallLegend({ className }: { className?: string }) {
  const item = 'flex items-center gap-1.5'
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-muted', className)} aria-label="Map legend">
      <li className={item}>
        <span aria-hidden className="size-3.5 rounded-[3px] bg-[var(--st-occupied)]" /> {t.stallStatus.occupied}
      </li>
      <li className={item}>
        <span aria-hidden className="size-3.5 rounded-[3px] border-[1.5px] border-dashed border-[var(--st-vacant)]" /> {t.stallStatus.vacant} (V)
      </li>
      <li className={item}>
        <span aria-hidden className="size-3.5 rounded-[3px] bg-[var(--st-reserved)]" /> {t.stallStatus.reserved} (R)
      </li>
      <li className={item}>
        <span aria-hidden className="size-3.5 rounded-[3px] border-[1.5px] border-[var(--st-repair)] bg-[repeating-linear-gradient(45deg,transparent_0_2px,var(--st-repair)_2px_3px)] opacity-80" /> {t.stallStatus.under_repair} (U)
      </li>
      <li className={item}>
        <span aria-hidden className="size-2.5 rounded-full bg-[var(--st-expiring)]" /> {t.stallStatus.expiring} (30 days)
      </li>
      <li className={item}>
        <span aria-hidden className="size-2.5 rounded-[2px] bg-[var(--st-arrears)]" /> {t.stallStatus.arrears}
      </li>
    </ul>
  )
}
