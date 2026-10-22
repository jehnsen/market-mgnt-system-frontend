import { lguConfig } from '@/config/lgu'
import { t } from '@/i18n'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar px-12 py-12 text-sidebar-ink lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-[0.08]">
          <svg viewBox="0 0 600 160" className="h-full w-full" preserveAspectRatio="none">
            <path d="M0 80 Q75 50 150 80 T300 80 T450 80 T600 80 V160 H0Z" fill="#d4893a" />
            <path d="M0 110 Q75 80 150 110 T300 110 T450 110 T600 110 V160 H0Z" fill="#4fb3b0" />
          </svg>
        </div>
        <p className="small-caps text-[13px] text-sidebar-muted">
          {lguConfig.country} · {lguConfig.province}
        </p>
        <div className="my-auto max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lguConfig.sealPath} alt={`Seal of the ${lguConfig.municipality}`} className="size-24 rounded-full bg-white p-1" />
          <p className="mt-8 font-heading text-5xl font-bold tracking-[0.1em] text-white">{t.app.name}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-sidebar-ink/85">{t.app.fullName}</p>
          <div aria-hidden className="mt-6 h-0.5 w-16 rounded-full bg-accent" />
          <p className="mt-6 font-heading text-xl font-semibold text-white">{t.app.tagline}</p>
          <p className="mt-1 text-sm text-sidebar-muted">
            {lguConfig.officeName} · {lguConfig.municipality}
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">{t.notices.demoData}</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
