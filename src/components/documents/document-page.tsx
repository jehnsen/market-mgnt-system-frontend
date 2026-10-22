'use client'

import * as React from 'react'
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { lguConfig } from '@/config/lgu'
import { useBranding } from '@/hooks/api'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export interface Signatory {
  role: string
  name?: string
  title?: string
}

interface DocumentPageProps {
  title: string
  subtitle?: React.ReactNode
  /** Right-aligned reference block (document number, dates). */
  meta?: { label: string; value: React.ReactNode }[]
  children: React.ReactNode
  signatures?: Signatory[]
  notOfficialReceipt?: boolean
  footnote?: React.ReactNode
  className?: string
  /** Office line under the LGU header; defaults to the Treasurer's office. */
  office?: string
}

/** Official-form styling: LGU header with seal, title, body and signature blocks. Prints on A4. */
export function DocumentPage({ title, subtitle, meta, children, signatures, notOfficialReceipt, footnote, className, office }: DocumentPageProps) {
  const branding = useBranding().data
  const seal = branding?.sealDataUrl ?? lguConfig.sealPath
  return (
    <article className={cn('doc-page mx-auto w-full max-w-[800px] border border-border bg-white px-6 py-8 text-[#111] shadow-sm sm:px-12 sm:py-10 dark:shadow-none', className)}>
      <header className="doc-avoid-break flex items-center gap-4 border-b-2 border-[#0e5e63] pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={seal} alt="" className="size-16 shrink-0 sm:size-20" />
        <div className="min-w-0 flex-1 text-center">
          <p className="small-caps text-[13px] text-[#444]">{lguConfig.country}</p>
          <p className="small-caps text-[13px] text-[#444]">{branding?.province ?? lguConfig.province}</p>
          <p className="font-heading text-[17px] font-semibold">{branding?.municipality ?? lguConfig.municipality}</p>
          <p className="text-[13px] font-semibold tracking-wide text-[#0e5e63] uppercase">{office ?? branding?.officeName ?? lguConfig.officeName}</p>
          <p className="mt-0.5 text-[11.5px] text-[#555]">{lguConfig.officeAddress}</p>
        </div>
        <div aria-hidden className="hidden size-16 shrink-0 sm:block sm:size-20" />
      </header>

      <div className="doc-avoid-break mt-6 text-center">
        <h1 className="font-heading text-[19px] font-bold tracking-wide uppercase">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13.5px] text-[#444]">{subtitle}</p> : null}
      </div>

      {meta && meta.length ? (
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-1 text-[13px] sm:grid-cols-2">
          {meta.map((m) => (
            <div key={m.label} className="flex justify-between gap-3 border-b border-dotted border-[#bbb] py-0.5">
              <dt className="text-[#555]">{m.label}</dt>
              <dd className="text-right font-medium">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-6 text-[13.5px] leading-relaxed">{children}</div>

      {signatures && signatures.length ? (
        <div className={cn('doc-avoid-break mt-12 grid gap-10', signatures.length > 1 ? 'sm:grid-cols-2' : 'sm:max-w-xs')}>
          {signatures.map((s) => (
            <div key={s.role}>
              <p className="text-[12px] text-[#555]">{s.role}</p>
              <div className="mt-10 border-b border-[#111]" />
              <p className="mt-1 text-[13.5px] font-semibold uppercase">{s.name ?? ' '}</p>
              {s.title ? <p className="text-[12px] text-[#555]">{s.title}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {notOfficialReceipt || footnote ? (
        <footer className="mt-10 border-t border-[#bbb] pt-3 text-center text-[12px] text-[#444]">
          {notOfficialReceipt ? <p className="font-semibold tracking-wide uppercase">{t.notices.notOfficialReceipt}</p> : null}
          {footnote ? <div className="mt-1">{footnote}</div> : null}
        </footer>
      ) : null}
    </article>
  )
}

/** Print / back bar shown above document previews (hidden on paper). */
export function PrintBar({ children, backLabel = 'Back' }: { children?: React.ReactNode; backLabel?: string }) {
  const router = useRouter()
  return (
    <div className="no-print mx-auto mb-4 flex w-full max-w-[800px] flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeftIcon /> {backLabel}
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button size="sm" onClick={() => window.print()}>
          <PrinterIcon /> {t.common.print}
        </Button>
      </div>
    </div>
  )
}

/** Table styling for document bodies (black on white, ruled). */
export function DocTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-[12.5px] [&_td]:border [&_td]:border-[#999] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[#999] [&_th]:bg-[#eef3f2] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold', className)}>
        {children}
      </table>
    </div>
  )
}
