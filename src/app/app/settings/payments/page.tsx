'use client'

import { BanknoteIcon, LockIcon, QrCodeIcon, SmartphoneIcon } from 'lucide-react'
import { SectionTitle } from '@/components/shared/page-header'
import { Notice } from '@/components/shared/states'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/controls'
import { Label } from '@/components/ui/form-field'

const CHANNELS = [
  { id: 'ewallet', icon: SmartphoneIcon, title: 'E-wallet payments', body: 'Lessees pay monthly rentals from a mobile wallet. Payments post to the ledger automatically.' },
  { id: 'qr', icon: QrCodeIcon, title: 'QR payments at the stall', body: 'A QR code per stall lets lessees and transient sellers pay a daily fee without cash.' },
  { id: 'bank', icon: BanknoteIcon, title: 'Bank and over-the-counter', body: 'Match deposits at partner banks to open charges.' },
]

export default function PaymentsPage() {
  return (
    <>
      <SectionTitle>Digital payments</SectionTitle>
      <Notice tone="info" icon={<LockIcon />} className="mb-4">
        <strong className="font-semibold">Available in Phase 2.</strong> MARCIS currently records collections made in cash against the Municipality&apos;s official receipts and cash tickets. These options are shown for planning and cannot be turned on yet.
      </Notice>
      <div className="grid gap-4 md:grid-cols-3">
        {CHANNELS.map((c) => (
          <Card key={c.id} aria-disabled="true" className="opacity-80">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-muted">
                  <c.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <CardTitle as="h3">{c.title}</CardTitle>
                  <CardDescription>{c.body}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardBody className="flex items-center justify-between gap-3">
              <Label htmlFor={`pay-${c.id}`} className="text-ink-muted">
                Phase 2
              </Label>
              <Switch id={`pay-${c.id}`} checked={false} disabled aria-label={`${c.title} (available in Phase 2)`} />
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  )
}
