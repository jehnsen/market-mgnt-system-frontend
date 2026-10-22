'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CornerDownLeftIcon, LayoutGridIcon, ReceiptTextIcon, UserIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Kbd } from '@/components/ui/misc'
import { marketName } from '@/config/lgu'
import { NAV } from '@/config/nav'
import { useSearch } from '@/hooks/api'
import { formatDate } from '@/lib/dates'
import { formatPeso } from '@/lib/money'
import { can } from '@/lib/permissions'
import { useSession } from '@/lib/session'

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const { role } = useSession()
  const [q, setQ] = React.useState('')
  const debounced = useDebounced(q, 200)
  const search = useSearch(debounced)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const go = (href: string) => {
    onOpenChange(false)
    setQ('')
    router.push(href)
  }

  const pages = NAV.flatMap((g) => g.items).filter((i) => !i.permission || can(role, i.permission))
  const results = search.data
  const showResults = debounced.trim().length >= 2

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">Search MARCIS</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Jump to a page, a stall by code, a lessee by name or a collection by receipt serial.</DialogPrimitive.Description>
          <Command shouldFilter={!showResults} loop>
            <CommandInput value={q} onValueChange={setQ} placeholder="Stall code, lessee name, receipt serial or page…" />
            <CommandList>
              <CommandEmpty>{search.isFetching ? 'Searching…' : 'No matches.'}</CommandEmpty>
              {showResults && results ? (
                <>
                  {results.stalls.length && can(role, 'stalls.view') ? (
                    <CommandGroup heading="Stalls">
                      {results.stalls.map((s) => (
                        <CommandItem key={s.id} value={`stall ${s.code} ${s.id}`} onSelect={() => go(`/app/stalls/${s.id}`)}>
                          <LayoutGridIcon />
                          <span className="num font-medium">{s.code}</span>
                          <span className="truncate text-ink-muted">
                            {marketName(s.marketId, true)} · {s.sectionName}
                            {s.lesseeName ? ` · ${s.lesseeName}` : ' · vacant'}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.lessees.length && can(role, 'lessees.view') ? (
                    <CommandGroup heading="Lessees">
                      {results.lessees.map((l) => (
                        <CommandItem key={l.id} value={`lessee ${l.name} ${l.id}`} onSelect={() => go(`/app/lessees/${l.id}`)}>
                          <UserIcon />
                          <span className="font-medium">{l.name}</span>
                          <span className="num truncate text-ink-muted">{l.stallCodes.join(', ') || 'no active stall'}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.collections.length && can(role, 'collections.view') ? (
                    <CommandGroup heading="Collections by serial">
                      {results.collections.map((c) => (
                        <CommandItem key={c.id} value={`collection ${c.serial} ${c.id}`} onSelect={() => go(`/app/collections?id=${encodeURIComponent(c.id)}&from=${c.date}&to=${c.date}`)}>
                          <ReceiptTextIcon />
                          <span className="num font-medium">
                            {c.formType === 'af51' ? 'OR' : 'CT'} {c.serial}
                          </span>
                          <span className="truncate text-ink-muted">
                            {formatPeso(c.amount)} · {formatDate(c.date)} · {c.collectorName}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  <CommandSeparator />
                </>
              ) : null}
              <CommandGroup heading="Go to">
                {pages.map((p) => (
                  <CommandItem key={p.href} value={`page ${p.label}`} onSelect={() => go(p.href)}>
                    <p.icon />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs text-ink-muted">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> to move
              </span>
              <span className="flex items-center gap-1">
                <Kbd>
                  <CornerDownLeftIcon className="size-3" />
                </Kbd>{' '}
                to open
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Esc</Kbd> to close
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
