import * as React from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
  /** Browser tab title; defaults to the title when it is plain text. */
  documentTitle?: string
}

export function PageHeader({ title, description, eyebrow, actions, meta, className, documentTitle }: PageHeaderProps) {
  const tabTitle = documentTitle ?? (typeof title === 'string' ? title : null)
  return (
    <header className={cn('mb-6', className)}>
      {tabTitle ? <title>{`${tabTitle} · MARCIS`}</title> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-1 text-[13px] text-ink-muted">{eyebrow}</div> : null}
          <h1 className="font-heading text-[1.5rem] leading-8 font-semibold text-ink sm:text-page">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-[15px] text-ink-muted">{description}</p> : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="no-print flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div aria-hidden className="mt-4 h-0.5 w-16 rounded-full bg-primary" />
    </header>
  )
}

export function SectionTitle({ children, className, action, id }: { children: React.ReactNode; className?: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 id={id} className="font-heading text-section font-semibold">
        {children}
      </h2>
      {action}
    </div>
  )
}
