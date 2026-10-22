'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { t } from '@/i18n'
import { useAppContext } from '@/lib/app-context'
import { formatDate } from '@/lib/dates'
import { useSession } from '@/lib/session'
import { CommandPalette } from './command-palette'
import { BrandLockup, Sidebar, SidebarFooter, SidebarNav } from './sidebar'
import { NotificationsBell, ThemeToggle, Topbar } from './topbar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, session } = useSession()
  const { isToday, date, setDate } = useAppContext()
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)

  React.useEffect(() => {
    if (!ready) return
    if (!session) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    else if (!session.verified) router.replace('/login/verify')
  }, [ready, session, router, pathname])

  if (!ready || !session || !session.verified) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <p className="text-sm text-ink-muted">{t.common.loading}</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t.app.skipToContent}
      </a>
      <Sidebar />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-ink [&>button]:text-sidebar-ink">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="border-b border-sidebar-border px-5 py-4">
            <BrandLockup />
          </div>
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
          <div className="flex gap-1 border-t border-sidebar-border px-3 py-2 sm:hidden [&_button]:text-sidebar-ink [&_a]:text-sidebar-ink">
            <NotificationsBell />
            <ThemeToggle />
          </div>
          <SidebarFooter />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <Topbar onOpenMenu={() => setMenuOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        {!isToday ? (
          <div className="no-print border-b border-accent/40 bg-accent-soft px-4 py-2 text-center text-[13px] text-ink sm:px-6">
            Viewing as of <strong>{formatDate(date)}</strong>. Pages that follow the date context show that day.{' '}
            <button type="button" className="font-medium text-primary underline underline-offset-2" onClick={() => setDate('today')}>
              Back to today
            </button>
          </div>
        ) : null}
        <main id="main" tabIndex={-1} data-print-root className="mx-auto w-full max-w-[1360px] px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
