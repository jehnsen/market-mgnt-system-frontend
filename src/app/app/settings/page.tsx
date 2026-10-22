'use client'

import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SETTINGS_NAV } from '@/config/settings-nav'
import { can } from '@/lib/permissions'
import { useSession } from '@/lib/session'

export default function SettingsIndex() {
  const { role } = useSession()
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {SETTINGS_NAV.filter((i) => can(role, i.permission)).map((i) => (
        <li key={i.href}>
          <Card className="h-full hover:border-border-strong">
            <Link href={i.href} className="flex h-full items-start justify-between gap-3 p-4">
              <span>
                <span className="block font-heading font-semibold">{i.label}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{i.description}</span>
              </span>
              <ArrowRightIcon className="mt-1 size-4 shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  )
}
