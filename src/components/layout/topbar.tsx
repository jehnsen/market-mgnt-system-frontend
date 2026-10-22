'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { BellIcon, CalendarDaysIcon, ChevronRightIcon, LogOutIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon, UserCogIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@/components/ui/menus'
import { Kbd } from '@/components/ui/misc'
import { lguConfig } from '@/config/lgu'
import { SEGMENT_LABEL } from '@/config/nav'
import { useNotifications } from '@/hooks/api'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { addDays, formatDate, formatWeekday } from '@/lib/dates'
import { ROLE_LABEL, ROLES } from '@/lib/permissions'
import { useSession } from '@/lib/session'
import { cn, initials } from '@/lib/utils'
import type { Role } from '@/types'

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length <= 1) return <p className={cn('truncate text-sm font-medium', className)}>{SEGMENT_LABEL.app}</p>
  const crumbs = parts.map((p, i) => ({ href: `/${parts.slice(0, i + 1).join('/')}`, label: SEGMENT_LABEL[p] ?? decodeURIComponent(p).toUpperCase() }))
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={c.href} className={cn('flex min-w-0 items-center gap-1', !last && 'hidden sm:flex')}>
              {last ? (
                <span aria-current="page" className="truncate font-medium text-ink">
                  {c.label}
                </span>
              ) : (
                <>
                  <Link href={c.href} className="truncate text-ink-muted hover:text-ink">
                    {c.label}
                  </Link>
                  <ChevronRightIcon className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function MarketSwitcher() {
  const { market, setMarket } = useAppContext()
  return (
    <label className="flex items-center">
      <span className="sr-only">{t.topbar.market}</span>
      <NativeSelect value={market} onChange={(e) => setMarket(e.target.value)} className="h-9 w-[7.5rem] font-medium sm:w-44">
        <option value="all">{t.topbar.allMarkets}</option>
        {lguConfig.markets.map((m) => (
          <option key={m.id} value={m.id}>
            {m.shortName}
          </option>
        ))}
      </NativeSelect>
    </label>
  )
}

function DateContextControl() {
  const { date, isToday, today, setDate } = useAppContext()
  const id = React.useId()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={cn('h-9 gap-2 px-3', !isToday && 'border-accent bg-accent-soft text-ink')} aria-label={`Date context: ${isToday ? 'Today' : formatDate(date)}. Change`}>
          <CalendarDaysIcon className={cn(!isToday && 'text-accent-ink')} />
          <span className="hidden md:inline">{isToday ? t.topbar.today : formatDate(date)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-sm font-medium">View the app as of</p>
        <div className="grid gap-2">
          <Button variant={isToday ? 'primary' : 'secondary'} size="sm" onClick={() => setDate('today')}>
            Today · {formatWeekday(today)}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDate(addDays(today, -1))}>
            Yesterday
          </Button>
          <label htmlFor={id} className="mt-1 text-[13px] text-ink-muted">
            {t.topbar.chooseDay}
          </label>
          <Input id={id} type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationsBell() {
  const { data } = useNotifications()
  const unread = data?.filter((n) => !n.read).length ?? 0
  return (
    <Tooltip content={t.topbar.notifications}>
      <Button asChild variant="ghost" size="icon" className="relative">
        <Link href="/app/notifications" aria-label={`${t.topbar.notifications}${unread ? `, ${unread} unread` : ''}`}>
          <BellIcon />
          {unread > 0 ? (
            <span className="num absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-[#2a1600]">{unread}</span>
          ) : null}
        </Link>
      </Button>
    </Tooltip>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  return (
    <Tooltip content={t.topbar.toggleTheme}>
      <Button variant="ghost" size="icon" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={t.topbar.toggleTheme}>
        <SunIcon className="hidden dark:block" />
        <MoonIcon className="dark:hidden" />
      </Button>
    </Tooltip>
  )
}

function UserMenu() {
  const { user, role, signOut, switchRole } = useSession()
  const router = useRouter()
  if (!user || !role) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-md py-1 pr-1 pl-1 hover:bg-surface-muted sm:pr-2" aria-label={t.topbar.userMenu}>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-ink">{initials(user.name)}</span>
          <span className="hidden text-left leading-tight xl:block">
            <span className="block max-w-40 truncate text-[13px] font-medium">{user.name}</span>
            <span className="block text-[11.5px] text-ink-muted">{ROLE_LABEL[role]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-ink">
          <span className="block text-sm font-semibold">{user.name}</span>
          <span className="block text-xs font-normal text-ink-muted">{user.title}</span>
          <span className="block text-xs font-normal text-ink-muted">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <UserCogIcon className="size-3.5" /> {t.topbar.switchRole}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={(v) => void switchRole(v as Role)}>
          {ROLES.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {ROLE_LABEL[r]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            signOut()
            router.replace('/login')
          }}
        >
          <LogOutIcon /> {t.topbar.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Topbar({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="flex h-16 items-center gap-2 px-3 sm:px-5 lg:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label={t.topbar.openMenu}>
          <MenuIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="small-caps hidden truncate text-[11.5px] leading-4 text-ink-muted md:block">
            {lguConfig.country} · {lguConfig.province}
          </p>
          <Breadcrumbs />
        </div>
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-9 w-64 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-sm text-ink-subtle hover:border-border-strong xl:flex"
        >
          <SearchIcon className="size-4" aria-hidden />
          <span className="flex-1 truncate text-left">{t.topbar.search}</span>
          <Kbd>Ctrl K</Kbd>
        </button>
        <Button variant="ghost" size="icon" className="xl:hidden" onClick={onOpenSearch} aria-label={t.common.search}>
          <SearchIcon />
        </Button>
        <MarketSwitcher />
        <DateContextControl />
        <div className="hidden sm:flex">
          <NotificationsBell />
          <ThemeToggle />
        </div>
        <UserMenu />
      </div>
    </header>
  )
}

export { NotificationsBell, ThemeToggle }
