import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'section'>) {
  return <section data-slot="card" className={cn('rounded-lg border border-border bg-surface', className)} {...props} />
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5', className)} {...props} />
}

export function CardTitle({ className, as: Tag = 'h2', ...props }: React.ComponentProps<'h2'> & { as?: 'h2' | 'h3' }) {
  return <Tag className={cn('font-heading text-base font-semibold text-ink', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-0.5 text-[13px] text-ink-muted', className)} {...props} />
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-4 py-4 sm:px-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5', className)} {...props} />
}
