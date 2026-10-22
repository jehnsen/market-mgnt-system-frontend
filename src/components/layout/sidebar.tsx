'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { lguConfig } from '@/config/lgu'
import { NAV } from '@/config/nav'
import { t } from '@/i18n'
import { can } from '@/lib/permissions'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

export function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lguConfig.sealPath} alt="" className="size-10 shrink-0 rounded-full bg-white p-0.5" />
      <div className="min-w-0">
        <p className="font-heading text-[19px] leading-6 font-bold tracking-[0.08em] text-white">{t.app.name}</p>
        {!compact ? <p className="truncate text-[11.5px] leading-4 text-sidebar-muted">{lguConfig.municipality}</p> : null}
      </div>
    </div>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { role } = useSession()
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(role, i.permission))
        if (items.length === 0) return null
        return (
          <div key={group.label} className="mb-5">
            <p className="small-caps mb-1.5 px-3 text-[12px] font-semibold text-sidebar-muted">{group.label}</p>
            <ul className="grid gap-0.5">
              {items.map((item) => {
                const active = item.href === '/app' ? pathname === '/app' : pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium text-sidebar-ink/85 transition-colors hover:bg-sidebar-active/60 hover:text-white focus-visible:outline-[#5fc0d1]',
                        active && 'bg-sidebar-active text-white',
                      )}
                    >
                      {active ? <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-accent" /> : null}
                      <Icon className={cn('size-[18px] shrink-0', active ? 'text-accent' : 'text-sidebar-muted')} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

export function SidebarFooter() {
  return (
    <div className="border-t border-sidebar-border px-5 py-3 text-[11.5px] leading-4 text-sidebar-muted">
      <p className="small-caps">
        {lguConfig.country} · {lguConfig.province.replace('Province of ', 'Province of ')}
      </p>
      <p className="mt-0.5">{lguConfig.officeName}</p>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex">
      <div className="border-b border-sidebar-border px-5 py-4">
        <BrandLockup />
      </div>
      <SidebarNav />
      <SidebarFooter />
    </aside>
  )
}
