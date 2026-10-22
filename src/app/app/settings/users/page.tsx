'use client'

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { ShieldCheckIcon, UserPlusIcon } from 'lucide-react'
import { DataTable } from '@/components/shared/data-table'
import { SectionTitle } from '@/components/shared/page-header'
import { RoleGate } from '@/components/shared/role-gate'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { useChangeRole, useInviteUser, useSetUserStatus, useUsers } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/dates'
import { ROLE_DESCRIPTION, ROLE_LABEL, ROLES } from '@/lib/permissions'
import { useSession } from '@/lib/session'
import type { Role, User } from '@/types'

export default function UsersPage() {
  return (
    <RoleGate permission="settings.users" page="user management">
      <Users />
    </RoleGate>
  )
}

function Users() {
  const users = useUsers()
  const changeRole = useChangeRole()
  const setStatus = useSetUserStatus()
  const { user: me } = useSession()
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const columns = React.useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (r) => r.name,
        cell: ({ row }) => (
          <span>
            <span className="block font-medium">{row.original.name}</span>
            <span className="block text-xs text-ink-muted">{row.original.email}</span>
          </span>
        ),
        meta: { primary: true, label: 'Name' },
      },
      { id: 'title', header: 'Position', accessorFn: (r) => r.title, cell: ({ getValue }) => <span className="text-[13px] text-ink-muted">{String(getValue())}</span>, meta: { label: 'Position' } },
      {
        id: 'role',
        header: 'Role',
        accessorFn: (r) => r.role,
        cell: ({ row }) => (
          <NativeSelect
            aria-label={`Role of ${row.original.name}`}
            value={row.original.role}
            disabled={row.original.id === me?.id || row.original.status === 'deactivated'}
            onChange={(e) => changeRole.mutate({ userId: row.original.id, role: e.target.value as Role }, { onSuccess: (u) => toast.success(`${u.name} is now ${ROLE_LABEL[u.role]}.`) })}
            className="h-8 w-48"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        ),
        meta: { label: 'Role' },
      },
      { id: 'mfa', header: '2-step', accessorFn: (r) => (r.mfaEnabled ? 1 : 0), cell: ({ row }) => (row.original.mfaEnabled ? <ShieldCheckIcon className="size-4 text-money-in" aria-label="2-step verification on" /> : <span className="text-xs text-ink-subtle">Off</span>), meta: { label: '2-step', align: 'center' } },
      { id: 'last', header: 'Last sign-in', accessorFn: (r) => r.lastLoginAt ?? '', cell: ({ row }) => <span className="text-[13px] text-ink-muted">{row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : 'Never'}</span>, meta: { label: 'Last sign-in' } },
      { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: ({ row }) => <StatusBadge kind="active" value={row.original.status} />, meta: { label: 'Status' } },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.id === me?.id ? (
            <span className="text-xs text-ink-muted">You</span>
          ) : row.original.status === 'deactivated' ? (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ userId: row.original.id, status: 'active' }, { onSuccess: () => toast.success('User reactivated.') })}>
              Reactivate
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="text-money-short" onClick={() => setStatus.mutate({ userId: row.original.id, status: 'deactivated' }, { onSuccess: () => toast.success('User deactivated. They can no longer sign in.') })}>
              Deactivate
            </Button>
          ),
        meta: { label: 'Actions', align: 'right' },
      },
    ],
    [changeRole, setStatus, me?.id],
  )
  return (
    <>
      <SectionTitle
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlusIcon /> Invite user
          </Button>
        }
      >
        Users & roles
      </SectionTitle>
      <DataTable data={users.data} isLoading={users.isLoading} isError={users.isError} onRetry={() => users.refetch()} columns={columns} getRowId={(r) => r.id} caption="Users" />
      <section aria-labelledby="roles-h" className="mt-6">
        <h3 id="roles-h" className="mb-2 text-sm font-semibold">
          What each role can do
        </h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="rounded-md border border-border bg-surface p-3">
              <dt className="font-medium">{ROLE_LABEL[r]}</dt>
              <dd className="text-[13px] text-ink-muted">{ROLE_DESCRIPTION[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  )
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const invite = useInviteUser()
  const [form, setForm] = React.useState({ name: '', email: '', title: '', role: 'treasury_staff' as Role })
  const [errors, setErrors] = React.useState<Partial<Record<'name' | 'email' | 'title', string>>>({})
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>They receive an email to set their password. Treasurer and Administrator accounts must set up 2-step verification.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const next: typeof errors = {}
            if (form.name.trim().length < 3) next.name = 'Enter the full name.'
            if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email.'
            if (form.title.trim().length < 3) next.title = 'Enter the position.'
            setErrors(next)
            if (Object.keys(next).length) return
            invite.mutate(form, {
              onSuccess: (u) => {
                toast.success(`Invitation sent to ${u.email}.`)
                onOpenChange(false)
                setForm({ name: '', email: '', title: '', role: 'treasury_staff' })
              },
            })
          }}
        >
          <Field label="Full name" htmlFor="iv-name" error={errors.name}>
            <Input id="iv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Office email" htmlFor="iv-email" error={errors.email}>
            <Input id="iv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Position" htmlFor="iv-title" error={errors.title}>
            <Input id="iv-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-invalid={Boolean(errors.title)} />
          </Field>
          <Field label="Role" htmlFor="iv-role" hint={ROLE_DESCRIPTION[form.role]}>
            <NativeSelect id="iv-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} aria-describedby="iv-role-hint">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? t.common.saving : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
