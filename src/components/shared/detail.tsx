import * as React from 'react'
import { FileIcon, FileImageIcon, FileTextIcon } from 'lucide-react'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { StallDocument } from '@/types'

/** Definition list grid for detail pages. */
export function DetailList({ items, className, cols = 2 }: { items: { label: string; value: React.ReactNode }[]; className?: string; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 text-sm', { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols], className)}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-ink-muted">{i.label}</dt>
          <dd className="mt-0.5 break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function DocumentList({ documents }: { documents: StallDocument[] }) {
  if (documents.length === 0) return <p className="text-sm text-ink-muted">No documents on file.</p>
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {documents.map((d) => {
        const Icon = d.kind === 'photo' ? FileImageIcon : d.kind === 'lease_contract' ? FileTextIcon : FileIcon
        return (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
            <span className="hidden text-xs text-ink-muted sm:inline">{d.sizeKb.toLocaleString()} KB</span>
            <span className="text-xs text-ink-muted">{formatDate(d.uploadedAt)}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Vertical timeline for status histories and device events. */
export function Timeline({ items }: { items: { id: string; title: React.ReactNode; meta: React.ReactNode; body?: React.ReactNode }[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">No history yet.</p>
  return (
    <ol className="relative ml-2 border-l border-border">
      {items.map((i) => (
        <li key={i.id} className="mb-5 ml-5 last:mb-0">
          <span aria-hidden className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-surface bg-primary" />
          <p className="text-sm font-medium">{i.title}</p>
          <p className="text-xs text-ink-muted">{i.meta}</p>
          {i.body ? <div className="mt-1 text-sm text-ink-muted">{i.body}</div> : null}
        </li>
      ))}
    </ol>
  )
}
