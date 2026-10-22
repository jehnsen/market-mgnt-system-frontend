'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { t } from '@/i18n'
import { SETTINGS_NAV } from '@/config/settings-nav'
import { can } from '@/lib/permissions'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'


export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { role } = useSession()
  const items = SETTINGS_NAV.filter((i) => can(role, i.permission))
  return (
    <RoleGate permission="settings.view" page="settings">
      <PageHeader title={t.pages.settings.title} description={t.pages.settings.description} />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="no-print">
          <ul className="scrollbar-thin flex gap-1 overflow-x-auto lg:flex-col">
            {items.map((i) => {
              const active = pathname === i.href || pathname.startsWith(`${i.href}/`)
              return (
                <li key={i.href} className="shrink-0">
                  <Link href={i.href} aria-current={active ? 'page' : undefined} className={cn('block rounded-md px-3 py-2 text-sm whitespace-nowrap', active ? 'bg-primary-soft font-semibold text-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink')}>
                    {i.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </RoleGate>
  )
}
