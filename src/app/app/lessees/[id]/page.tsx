'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckIcon, MessageSquareTextIcon, PencilIcon, PrinterIcon, XIcon } from 'lucide-react'
import { AgingBar } from '@/components/finance/aging-bar'
import { Amount, StallCode } from '@/components/finance/amount'
import { LedgerTable } from '@/components/finance/ledger-table'
import { DetailList, DocumentList } from '@/components/shared/detail'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls'
import { marketName } from '@/config/lgu'
import { useLessee } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatDateTime, formatMonth } from '@/lib/dates'
import { maskPhone } from '@/lib/utils'

export default function LesseeDetailPage() {
  return (
    <RoleGate permission="lessees.view" page="lessee records">
      <LesseeDetail />
    </RoleGate>
  )
}

function LesseeDetail() {
  const { id } = useParams<{ id: string }>()
  const q = useLessee(id)
  const can = useCan()
  if (q.isLoading) return <PageSkeleton />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} message={q.error instanceof Error ? q.error.message : undefined} />
  const { lessee: l, leases, statement, notices, sms, documents } = q.data
  const showContact = can('lessees.viewContact')
  return (
    <>
      <PageHeader
        title={l.fullName}
        eyebrow={l.businessName ?? 'Lessee'}
        meta={
          <>
            <StatusBadge kind="lease" value={l.leaseStatus} />
            {l.stallCodes.map((c) => (
              <StallCode key={c} code={c} />
            ))}
            {l.smsConsent ? <span className="text-[13px] text-money-in">SMS reminders: on</span> : <span className="text-[13px] text-ink-muted">SMS reminders: off</span>}
          </>
        }
        actions={
          <>
            {can('billing.prepare') || can('billing.view') ? (
              <Button asChild variant="secondary">
                <Link href={`/app/billing/statements/print?ids=${l.id}`}>
                  <PrinterIcon /> Statement of account
                </Link>
              </Button>
            ) : null}
            {can('messages.send') && l.smsConsent ? (
              <Button asChild variant="secondary">
                <Link href={`/app/messages?lessee=${l.id}`}>
                  <MessageSquareTextIcon /> Send SMS
                </Link>
              </Button>
            ) : null}
            {can('lessees.manage') ? (
              <Button asChild>
                <Link href={`/app/lessees/${l.id}/edit`}>
                  <PencilIcon /> Edit
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody>
            <DetailList
              items={[
                { label: 'Mobile number', value: <span className="num">{showContact ? l.contactNumber : maskPhone(l.contactNumber)}</span> },
                { label: 'Email', value: showContact ? (l.email ?? '—') : l.email ? 'Hidden for your role' : '—' },
                { label: 'Address', value: l.address },
                { label: 'Registered', value: formatDate(l.registeredOn) },
                {
                  label: 'SMS consent',
                  value: l.smsConsent ? (
                    <span className="inline-flex items-center gap-1 text-money-in">
                      <CheckIcon className="size-4" aria-hidden /> Given {l.smsConsentAt ? formatDate(l.smsConsentAt) : ''}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-ink-muted">
                      <XIcon className="size-4" aria-hidden /> Not given
                    </span>
                  ),
                },
                { label: 'Notes', value: l.notes ?? '—' },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Balance</CardTitle>
              <CardDescription>{l.oldestUnpaidMonth ? `Oldest unpaid: ${formatMonth(l.oldestUnpaidMonth)}` : 'No unpaid months'}</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <Amount value={statement.closingBalance} size="lg" className={statement.closingBalance > statement.aging.current ? 'text-money-short' : undefined} />
            <AgingBar buckets={statement.aging} className="mt-4" />
          </CardBody>
        </Card>
      </div>

      <Tabs defaultValue="statement">
        <TabsList aria-label="Lessee record sections">
          <TabsTrigger value="statement">Statement of account</TabsTrigger>
          <TabsTrigger value="leases">Stalls & leases ({leases.length})</TabsTrigger>
          <TabsTrigger value="notices">Notices ({notices.length})</TabsTrigger>
          <TabsTrigger value="sms">SMS history ({sms.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="statement">
          <p className="mb-3 text-[13px] text-ink-muted">
            Charges, payments and penalties over the last 12 billing months, as of {formatDate(statement.asOf)}. {t.notices.notOfficialReceipt}
          </p>
          <LedgerTable lines={statement.lines} caption={`Statement of account of ${l.fullName}`} />
        </TabsContent>
        <TabsContent value="leases">
          {leases.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {leases.map((lease) => (
                <li key={lease.id}>
                  <Link href={`/app/leases/${lease.id}`} className="block rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          <StallCode code={lease.stallCode} /> <span className="num text-sm text-ink-muted">{lease.leaseNo}</span>
                        </p>
                        <p className="mt-1 text-[13px] text-ink-muted">
                          {marketName(lease.marketId, true)} · {lease.sectionName}
                        </p>
                      </div>
                      <StatusBadge kind="lease" value={lease.status === 'active' && lease.daysToExpiry <= 30 ? 'expiring' : lease.status} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
                      <div>
                        <dt className="text-xs text-ink-muted">Start</dt>
                        <dd>{formatDate(lease.startDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-muted">End</dt>
                        <dd>{formatDate(lease.terminatedOn ?? lease.endDate)}</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-xs text-ink-muted">Monthly</dt>
                        <dd>
                          <Amount value={lease.monthlyRate} />
                        </dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No leases" description="This lessee has not leased a stall yet." />
          )}
        </TabsContent>
        <TabsContent value="notices">
          {notices.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {notices.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="flex items-center gap-2">
                      <Link href={`/app/billing/notices/${n.id}`} className="num font-medium text-primary hover:underline">
                        {n.noticeNo}
                      </Link>
                      <StatusBadge kind="notice" value={n.level} />
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      Issued {formatDate(n.issuedOn)} · stall {n.stallCode} · due by {formatDate(n.dueBy)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Amount value={n.amountDue} />
                    <StatusBadge kind="response" value={n.response} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No demand notices" description="No notices have been issued to this lessee." />
          )}
        </TabsContent>
        <TabsContent value="sms">
          {sms.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {sms.slice(0, 40).map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{m.templateName}</p>
                    <span className="flex items-center gap-2 text-xs text-ink-muted">
                      {formatDateTime(m.sentAt ?? m.scheduledFor ?? m.createdAt)} <StatusBadge kind="sms" value={m.status} />
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">{m.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No SMS sent" description={l.smsConsent ? 'No reminders have been sent yet.' : 'This lessee has not agreed to receive SMS.'} />
          )}
        </TabsContent>
        <TabsContent value="documents">
          <DocumentList documents={documents} />
        </TabsContent>
      </Tabs>
    </>
  )
}
