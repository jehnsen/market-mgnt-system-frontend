'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** Route-based tabs (each tab is its own URL). */
export function LinkTabs({ tabs, label, className }: { tabs: { href: string; label: string; exact?: boolean }[]; label: string; className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label={label} className={cn('no-print scrollbar-thin mb-6 flex gap-1 overflow-x-auto border-b border-border', className)}>
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn('-mb-px inline-flex h-10 shrink-0 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap', active ? 'border-primary text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export const BILLING_TABS = [
  { href: '/app/billing', label: 'Billing run', exact: true },
  { href: '/app/billing/arrears', label: 'Arrears aging' },
  { href: '/app/billing/statements', label: 'Statements of account' },
  { href: '/app/billing/notices', label: 'Demand notices' },
]
