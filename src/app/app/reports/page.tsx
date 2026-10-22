'use client'

import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { REPORTS } from '@/config/reports'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { Card } from '@/components/ui/card'
import { t } from '@/i18n'
import { SB_REPORTS } from '@/lib/permissions'
import { useSession } from '@/lib/session'


export default function ReportsIndex() {
  const { role } = useSession()
  const list = role === 'sb' ? REPORTS.filter((r) => (SB_REPORTS as readonly string[]).includes(r.slug)) : REPORTS
  return (
    <RoleGate permission="reports.view" page="reports">
      <PageHeader title={t.pages.reports.title} description={t.pages.reports.description} />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <li key={r.slug}>
            <Card className="h-full transition-colors hover:border-border-strong">
              <Link href={`/app/reports/${r.slug}`} className="flex h-full flex-col p-5">
                <span className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <r.icon className="size-5" aria-hidden />
                </span>
                <span className="font-heading text-base font-semibold">{r.title}</span>
                <span className="mt-1 flex-1 text-sm text-ink-muted">{r.description}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open report <ArrowRightIcon className="size-4" aria-hidden />
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </RoleGate>
  )
}
