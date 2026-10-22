'use client'

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { SearchIcon } from 'lucide-react'
import { DataTable } from '@/components/shared/data-table'
import { SectionTitle } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { Input, NativeSelect } from '@/components/ui/input'
import { useAuditLog } from '@/hooks/api'
import { formatDateTime } from '@/lib/dates'
import { ROLE_LABEL } from '@/lib/permissions'
import type { AuditEntry, AuditValue } from '@/types'

const ACTION_GROUPS = [
  { value: 'all', label: 'All actions' },
  { value: 'user', label: 'Users and roles' },
  { value: 'fees', label: 'Fee schedule' },
  { value: 'stall', label: 'Stalls' },
  { value: 'section', label: 'Sections' },
  { value: 'lease', label: 'Leases' },
  { value: 'lessee', label: 'Lessees' },
  { value: 'collection', label: 'Collections and corrections' },
  { value: 'remittance', label: 'Remittances' },
  { value: 'recon', label: 'Reconciliation' },
  { value: 'day', label: 'Day close and reopen' },
  { value: 'forms', label: 'Accountable forms' },
  { value: 'billing', label: 'Billing' },
  { value: 'notice', label: 'Demand notices' },
  { value: 'sms', label: 'SMS' },
  { value: 'collector', label: 'Collectors' },
  { value: 'device', label: 'Devices' },
  { value: 'branding', label: 'Branding' },
]

export default function AuditPage() {
  return (
    <RoleGate permission="settings.audit" page="the audit log">
      <Audit />
    </RoleGate>
  )
}

function Audit() {
  const [q, setQ] = React.useState('')
  const [action, setAction] = React.useState('all')
  const deferredQ = React.useDeferredValue(q)
  const log = useAuditLog(deferredQ, action)
  const columns = React.useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      { id: 'at', header: 'When', accessorFn: (r) => r.at, cell: ({ row }) => <span className="text-[13px] whitespace-nowrap">{formatDateTime(row.original.at)}</span>, meta: { label: 'When' } },
      {
        id: 'actor',
        header: 'Who',
        accessorFn: (r) => r.actorName,
        cell: ({ row }) => (
          <span>
            <span className="block text-[13px] font-medium">{row.original.actorName}</span>
            <span className="block text-xs text-ink-muted">{row.original.actorRole === 'system' || row.original.actorRole === 'device' ? (row.original.actorRole === 'system' ? 'System' : 'Collector device') : ROLE_LABEL[row.original.actorRole]}</span>
          </span>
        ),
        meta: { label: 'Who' },
      },
      {
        id: 'summary',
        header: 'What',
        accessorFn: (r) => r.summary,
        cell: ({ row }) => (
          <span>
            <span className="block text-sm">{row.original.summary}</span>
            <span className="block text-xs text-ink-muted">
              {row.original.entity} · <span className="font-mono">{row.original.entityId}</span>
            </span>
          </span>
        ),
        meta: { primary: true, label: 'What' },
      },
      { id: 'before', header: 'Before', enableSorting: false, accessorFn: () => '', cell: ({ row }) => <Values values={row.original.before} />, meta: { label: 'Before' } },
      { id: 'after', header: 'After', enableSorting: false, accessorFn: () => '', cell: ({ row }) => <Values values={row.original.after} />, meta: { label: 'After' } },
    ],
    [],
  )
  return (
    <>
      <SectionTitle>Audit log</SectionTitle>
      <DataTable
        data={log.data}
        isLoading={log.isLoading}
        isError={log.isError}
        onRetry={() => log.refetch()}
        columns={columns}
        getRowId={(r) => r.id}
        caption="Audit log"
        pageSize={25}
        initialSorting={[{ id: 'at', desc: true }]}
        toolbar={
          <>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Person, action or record" aria-label="Search the audit log" className="w-64 pl-8" />
            </span>
            <NativeSelect value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" className="w-56">
              {ACTION_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />
    </>
  )
}

function Values({ values }: { values: Record<string, AuditValue> | null }) {
  if (!values) return <span className="text-xs text-ink-subtle">—</span>
  const entries = Object.entries(values)
  if (!entries.length) return <span className="text-xs text-ink-subtle">—</span>
  return (
    <dl className="grid gap-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="text-ink-muted">{k}:</dt>
          <dd className="font-mono break-words">{v === null ? '—' : String(v)}</dd>
        </div>
      ))}
    </dl>
  )
}
