import * as React from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-9 w-full min-w-0 rounded-md border border-border-strong/70 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-money-short'

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(inputClass, 'h-auto min-h-20 py-2 leading-relaxed', className)} {...props} />
}

/** Native select: accessible, keyboard friendly and good on phones. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        inputClass,
        'appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function MoneyInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted" aria-hidden>
        ₱
      </span>
      <Input inputMode="decimal" autoComplete="off" className={cn('num pl-7 text-right', className)} {...props} />
    </div>
  )
}
