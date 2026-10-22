'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { MoveIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { StallCode } from '@/components/finance/amount'
import { StallLegend } from '@/components/market/stall-map'
import { SectionTitle } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { Field } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { SECTION_CATEGORY_LABEL } from '@/config/markets'
import { useAddStall, useMarkets, useMoveStall, useSections, useStalls, useUpdateSection } from '@/hooks/api'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import type { StallType, StallView } from '@/types'

const StallMap = dynamic(() => import('@/components/market/stall-map').then((m) => m.StallMap), { ssr: false, loading: () => <Skeleton className="h-[480px]" /> })

const TYPES: StallType[] = ['standard', 'corner', 'cold', 'eatery', 'kiosk']

export default function MarketsSettingsPage() {
  return (
    <RoleGate permission="settings.markets" page="market settings">
      <MarketsSettings />
    </RoleGate>
  )
}

function MarketsSettings() {
  const markets = useMarkets()
  const [marketId, setMarketId] = React.useState('pm')
  const sections = useSections(marketId)
  const stalls = useStalls({ market: marketId })
  const move = useMoveStall()
  const add = useAddStall()
  const rename = useUpdateSection()
  const [mode, setMode] = React.useState<'move' | 'add'>('move')
  const [selected, setSelected] = React.useState<StallView | null>(null)
  const [newSection, setNewSection] = React.useState('')
  const [newType, setNewType] = React.useState<StallType>('standard')
  const [row, setRow] = React.useState('')
  const [col, setCol] = React.useState('')
  const [editing, setEditing] = React.useState<string | null>(null)
  const [name, setName] = React.useState('')
  const market = markets.data?.find((m) => m.id === marketId)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(null)
    setNewSection('')
  }, [marketId])

  const place = (x: number, y: number) => {
    if (mode === 'move') {
      if (!selected) return toast.info('Select a stall first, then click an empty tile.')
      move.mutate({ stallId: selected.id, gridX: x, gridY: y }, { onSuccess: (s) => { toast.success(`${s.code} moved to row ${y + 1}, column ${x + 1}.`); setSelected(s) } })
    } else {
      if (!newSection) return toast.info('Choose the section for the new stall.')
      add.mutate({ sectionId: newSection, type: newType, sizeSqm: newType === 'eatery' ? 9 : newType === 'kiosk' ? 3 : newType === 'standard' ? 4 : 6, gridX: x, gridY: y }, { onSuccess: (s) => toast.success(`Stall ${s.code} added as vacant.`) })
    }
  }

  return (
    <div className="grid gap-6">
      <SectionTitle action={<Segmented label="Market" value={marketId} onChange={setMarketId} options={(markets.data ?? []).map((m) => ({ value: m.id, label: m.shortName }))} />}>Markets, sections & stalls</SectionTitle>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Floor plan editor</CardTitle>
            <CardDescription>Empty tiles are outlined. Changes apply to the stall map right away and are audited.</CardDescription>
          </div>
          <Segmented
            label="Editor mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'move', label: 'Move stall', icon: <MoveIcon aria-hidden /> },
              { value: 'add', label: 'Add stall', icon: <PlusIcon aria-hidden /> },
            ]}
          />
        </CardHeader>
        <CardBody className="grid gap-4">
          {mode === 'move' ? (
            <div className="flex flex-wrap items-end gap-3">
              <p className="text-sm">
                {selected ? (
                  <>
                    Selected <StallCode code={selected.code} /> at row {selected.gridY + 1}, column {selected.gridX + 1}. Click an empty tile, or enter a position:
                  </>
                ) : (
                  'Click a stall to select it, then click an empty tile to move it there.'
                )}
              </p>
              {selected ? (
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const r = Number(row)
                    const c = Number(col)
                    if (r >= 1 && c >= 1) place(c - 1, r - 1)
                  }}
                >
                  <Field label="Row" htmlFor="mv-row">
                    <Input id="mv-row" inputMode="numeric" value={row} onChange={(e) => setRow(e.target.value)} className="h-8 w-16" />
                  </Field>
                  <Field label="Column" htmlFor="mv-col">
                    <Input id="mv-col" inputMode="numeric" value={col} onChange={(e) => setCol(e.target.value)} className="h-8 w-16" />
                  </Field>
                  <Button type="submit" size="sm" variant="secondary">
                    Move
                  </Button>
                </form>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Section" htmlFor="add-sec">
                <NativeSelect id="add-sec" value={newSection} onChange={(e) => setNewSection(e.target.value)} className="h-8 w-52">
                  <option value="">Choose…</option>
                  {sections.data
                    ?.filter((s) => s.category !== 'transient')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
              <Field label="Stall type" htmlFor="add-type">
                <NativeSelect id="add-type" value={newType} onChange={(e) => setNewType(e.target.value as StallType)} className="h-8 w-36">
                  {TYPES.map((tp) => (
                    <option key={tp} value={tp}>
                      {tp}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <p className="pb-1.5 text-sm text-ink-muted">Then click an empty tile to place it.</p>
            </div>
          )}
          <StallLegend />
          {market && sections.data && stalls.data ? (
            <StallMap market={market} sections={sections.data} stalls={stalls.data} selectedId={selected?.id} onSelect={(s) => { setSelected(s); setRow(String(s.gridY + 1)); setCol(String(s.gridX + 1)) }} onEmptyCell={place} height={480} />
          ) : (
            <Skeleton className="h-[480px]" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                {['Section', 'Category', 'Code prefix', 'Stalls', 'Grid block', ''].map((h, i) => (
                  <th key={i} className="border-b border-border bg-surface-muted px-4 py-2 font-semibold">
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.data?.map((s) => (
                <tr key={s.id}>
                  <td className="border-b border-border px-4 py-2">
                    {editing === s.id ? (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (name.trim().length < 2) return
                          rename.mutate({ id: s.id, name: name.trim() }, { onSuccess: () => { toast.success('Section renamed.'); setEditing(null) } })
                        }}
                      >
                        <Input aria-label="Section name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-48" autoFocus />
                        <Button type="submit" size="sm">
                          {t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          {t.common.cancel}
                        </Button>
                      </form>
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                  </td>
                  <td className="border-b border-border px-4 py-2">{SECTION_CATEGORY_LABEL[s.category]}</td>
                  <td className="num border-b border-border px-4 py-2">{s.codePrefix}-</td>
                  <td className="num border-b border-border px-4 py-2">{stalls.data?.filter((x) => x.sectionId === s.id).length ?? '—'}</td>
                  <td className="num border-b border-border px-4 py-2 text-ink-muted">
                    r{s.y + 1}–{s.y + s.rows}, c{s.x + 1}–{s.x + s.cols}
                  </td>
                  <td className={cn('border-b border-border px-4 py-2 text-right')}>
                    {editing !== s.id ? (
                      <Button size="icon-sm" variant="ghost" aria-label={`Rename ${s.name}`} onClick={() => { setEditing(s.id); setName(s.name) }}>
                        <PencilIcon />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Notice tone="info">Market and section layouts also live in <code className="num">src/config/markets.ts</code> so another LGU can start from its own floor plans.</Notice>
    </div>
  )
}
