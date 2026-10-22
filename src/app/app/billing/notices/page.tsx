'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { toast } from 'sonner'
import { MailWarningIcon, MessageSquareReplyIcon, PrinterIcon } from 'lucide-react'
import { Amount, StallCode } from '@/components/finance/amount'
import { BILLING_TABS, LinkTabs } from '@/components/layout/link-tabs'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { RoleGate, useCan } from '@/components/shared/role-gate'
import { EmptyState, Notice } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/form-field'
import { NativeSelect, Textarea } from '@/components/ui/input'
import { useIssueNotices, useNoticeCandidates, useNoticeResponse, useNotices } from '@/hooks/api'
import { t } from '@/i18n'
import type { NoticeCandidate } from '@/lib/api'
import { useAppContext } from '@/lib/app-context'
import { formatDate } from '@/lib/dates'
import { sumBy } from '@/lib/money'
import type { DemandNoticeLevel, DemandNoticeView, NoticeResponse } from '@/types'

export default function NoticesPage() {
  return (
    <RoleGate permission="billing.view" page="demand notices">
      <PageHeader title={t.pages.billing.title} description={t.pages.billing.description} documentTitle="Demand notices" />
      <LinkTabs tabs={BILLING_TABS} label="Billing sections" />
      <Notices />
    </RoleGate>
  )
}

function Notices() {
  const { market } = useAppContext()
  const can = useCan()
  const [level, setLevel] = React.useState<DemandNoticeLevel | 'all'>('all')
  const [response, setResponse] = React.useState<NoticeResponse | 'all'>('all')
  const [selection, setSelection] = React.useState<RowSelectionState>({})
  const [responding, setResponding] = React.useState<DemandNoticeView | null>(null)
  const candidates = useNoticeCandidates(market)
  const notices = useNotices({ market, level, response })
  const issue = useIssueNotices()
  const ids = Object.keys(selection).filter((k) => selection[k])

  const candCols = React.useMemo<ColumnDef<NoticeCandidate, unknown>[]>(
    () => [
      { id: 'lessee', header: 'Lessee', accessorFn: (r) => r.account.lesseeName, cell: ({ row }) => <span className="font-medium">{row.original.account.lesseeName}</span>, meta: { primary: true, label: 'Lessee' } },
      { id: 'stall', header: 'Stall', accessorFn: (r) => r.account.stallCode, cell: ({ row }) => <StallCode code={row.original.account.stallCode} />, meta: { label: 'Stall' } },
      { id: 'days', header: 'Days overdue', accessorFn: (r) => r.account.daysOverdue, cell: ({ row }) => <span className="num">{row.original.account.daysOverdue}</span>, meta: { align: 'right', label: 'Days overdue' } },
      { id: 'balance', header: 'Balance', accessorFn: (r) => r.account.balance, cell: ({ row }) => <Amount value={row.original.account.balance} />, meta: { align: 'right', label: 'Balance', footer: (rows) => <Amount value={sumBy(rows, (r) => r.account.balance)} /> } },
      { id: 'last', header: 'Last notice', accessorFn: (r) => r.account.lastNotice ?? '', cell: ({ row }) => (row.original.account.lastNotice ? <StatusBadge kind="notice" value={row.original.account.lastNotice} /> : <span className="text-ink-subtle">None</span>), meta: { label: 'Last notice' } },
      { id: 'next', header: 'Next notice', accessorFn: (r) => r.suggestedLevel, cell: ({ row }) => <StatusBadge kind="notice" value={row.original.suggestedLevel} />, meta: { label: 'Next notice' } },
    ],
    [],
  )

  const cols = React.useMemo<ColumnDef<DemandNoticeView, unknown>[]>(
    () => [
      { id: 'no', header: 'Notice', accessorFn: (r) => r.noticeNo, cell: ({ row }) => <Link href={`/app/billing/notices/${row.original.id}`} className="num font-medium text-primary hover:underline">{row.original.noticeNo}</Link>, meta: { primary: true, label: 'Notice' } },
      { id: 'level', header: 'Level', accessorFn: (r) => r.level, cell: ({ row }) => <StatusBadge kind="notice" value={row.original.level} />, meta: { label: 'Level' } },
      { id: 'lessee', header: 'Lessee', accessorFn: (r) => r.lesseeName, cell: ({ row }) => <Link href={`/app/lessees/${row.original.lesseeId}`} className="hover:underline">{row.original.lesseeName}</Link>, meta: { label: 'Lessee' } },
      { id: 'stall', header: 'Stall', accessorFn: (r) => r.stallCode, cell: ({ row }) => <StallCode code={row.original.stallCode} />, meta: { label: 'Stall' } },
      { id: 'issued', header: 'Issued', accessorFn: (r) => r.issuedOn, cell: ({ row }) => formatDate(row.original.issuedOn), meta: { label: 'Issued' } },
      { id: 'due', header: 'Due by', accessorFn: (r) => r.dueBy, cell: ({ row }) => formatDate(row.original.dueBy), meta: { label: 'Due by' } },
      { id: 'amount', header: 'Amount due', accessorFn: (r) => r.amountDue, cell: ({ row }) => <Amount value={row.original.amountDue} />, meta: { align: 'right', label: 'Amount' } },
      {
        id: 'response',
        header: 'Response',
        accessorFn: (r) => r.response,
        cell: ({ row }) => (
          <span className="grid gap-0.5">
            <StatusBadge kind="response" value={row.original.response} />
            {row.original.responseDate ? <span className="text-xs text-ink-muted">{formatDate(row.original.responseDate)}</span> : null}
          </span>
        ),
        meta: { label: 'Response' },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex justify-end gap-1">
            <Button asChild variant="ghost" size="icon-sm">
              <Link href={`/app/billing/notices/${row.original.id}`} aria-label={`Print ${row.original.noticeNo}`}>
                <PrinterIcon />
              </Link>
            </Button>
            {can('billing.prepare') ? (
              <Button variant="ghost" size="icon-sm" aria-label={`Record response to ${row.original.noticeNo}`} onClick={() => setResponding(row.original)}>
                <MessageSquareReplyIcon />
              </Button>
            ) : null}
          </span>
        ),
        meta: { hideOnCard: true, label: 'Actions' },
      },
    ],
    [can],
  )

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Accounts due for a notice</CardTitle>
            <CardDescription>Overdue more than 30 days with no notice in the last 15 days. First notice at 31+ days, second at 61+, final at 91+.</CardDescription>
          </div>
          {can('billing.issueNotices') ? (
            <Button
              disabled={ids.length === 0 || issue.isPending}
              onClick={() =>
                issue.mutate(ids, {
                  onSuccess: (list) => {
                    toast.success(`Issued ${list.length} demand notice${list.length === 1 ? '' : 's'}.`)
                    setSelection({})
                  },
                })
              }
            >
              <MailWarningIcon /> Issue {ids.length || ''} notice{ids.length === 1 ? '' : 's'}
            </Button>
          ) : (
            <span className="text-[13px] text-ink-muted">Only the Municipal Treasurer issues notices.</span>
          )}
        </CardHeader>
        <DataTable
          data={candidates.data}
          isLoading={candidates.isLoading}
          columns={candCols}
          getRowId={(r) => r.account.leaseId}
          caption="Accounts due for a demand notice"
          selection={can('billing.issueNotices') ? { value: selection, onChange: setSelection } : undefined}
          className="rounded-none border-0"
          maxHeight="380px"
          dense
          empty={<EmptyState compact title="No accounts are due for a notice" />}
        />
      </Card>

      <section aria-labelledby="issued-heading">
        <h2 id="issued-heading" className="mb-3 font-heading text-section font-semibold">
          Issued notices
        </h2>
        <DataTable
          data={notices.data}
          isLoading={notices.isLoading}
          isError={notices.isError}
          onRetry={() => notices.refetch()}
          columns={cols}
          getRowId={(r) => r.id}
          caption="Issued demand notices"
          toolbar={
            <>
              <NativeSelect aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value as DemandNoticeLevel | 'all')} className="h-8 w-40">
                <option value="all">All levels</option>
                {(['first', 'second', 'final'] as const).map((l) => (
                  <option key={l} value={l}>
                    {t.noticeLevel[l]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="Response" value={response} onChange={(e) => setResponse(e.target.value as NoticeResponse | 'all')} className="h-8 w-44">
                <option value="all">All responses</option>
                {(['none', 'paid', 'promised', 'disputed'] as const).map((r) => (
                  <option key={r} value={r}>
                    {t.noticeResponse[r]}
                  </option>
                ))}
              </NativeSelect>
            </>
          }
        />
      </section>
      <Notice tone="info">{t.notices.notOfficialReceipt} Demand notices are printed and served in person; the date of receipt is written on the lessee&apos;s copy.</Notice>
      {responding ? <ResponseDialog notice={responding} onClose={() => setResponding(null)} /> : null}
    </div>
  )
}

function ResponseDialog({ notice, onClose }: { notice: DemandNoticeView; onClose: () => void }) {
  const save = useNoticeResponse()
  const [response, setResponse] = React.useState<NoticeResponse>(notice.response === 'none' ? 'promised' : notice.response)
  const [note, setNote] = React.useState(notice.responseNote ?? '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Response to {notice.noticeNo}</DialogTitle>
          <DialogDescription>
            {notice.lesseeName} · stall {notice.stallCode} · {t.noticeLevel[notice.level].toLowerCase()} issued {formatDate(notice.issuedOn)}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(
              { id: notice.id, response, note },
              {
                onSuccess: () => {
                  toast.success('Response recorded.')
                  onClose()
                },
              },
            )
          }}
        >
          <Field label="Response" htmlFor="nr-resp">
            <NativeSelect id="nr-resp" value={response} onChange={(e) => setResponse(e.target.value as NoticeResponse)}>
              {(['none', 'paid', 'promised', 'disputed'] as const).map((r) => (
                <option key={r} value={r}>
                  {t.noticeResponse[r]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Note" htmlFor="nr-note" optional>
            <Textarea id="nr-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: will pay ₱2,000 every 15th until settled." />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
