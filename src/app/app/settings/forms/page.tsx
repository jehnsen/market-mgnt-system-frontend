'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { RoleGate } from '@/components/shared/role-gate'
import { SectionTitle } from '@/components/shared/page-header'
import { ErrorState, Notice, TableSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { useSettingsFormTypes, useUpdateFormType } from '@/hooks/api'
import { t } from '@/i18n'
import type { FormTypeConfig } from '@/types'

export default function FormTypesPage() {
  return (
    <RoleGate permission="settings.forms" page="accountable form types">
      <FormTypes />
    </RoleGate>
  )
}

function FormTypes() {
  const types = useSettingsFormTypes()
  return (
    <>
      <SectionTitle>Accountable form types</SectionTitle>
      <Notice className="mb-4">
        Prefixes and serial lengths are used to validate the serials collectors record. MARCIS records the Municipality&apos;s official receipts and cash tickets; it does not issue them.
      </Notice>
      {types.isLoading ? (
        <TableSkeleton rows={3} />
      ) : types.isError ? (
        <ErrorState onRetry={() => types.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {types.data?.map((ft) => <FormTypeCard key={ft.id} type={ft} />)}
        </div>
      )}
    </>
  )
}

function FormTypeCard({ type }: { type: FormTypeConfig }) {
  const update = useUpdateFormType()
  const [form, setForm] = React.useState({ name: type.name, prefix: type.prefix, serialLength: String(type.serialLength), unitsPerBooklet: String(type.unitsPerBooklet) })
  const [errors, setErrors] = React.useState<Partial<Record<keyof typeof form, string>>>({})
  const dirty = form.name !== type.name || form.prefix !== type.prefix || Number(form.serialLength) !== type.serialLength || Number(form.unitsPerBooklet) !== type.unitsPerBooklet
  const id = `ft-${type.id}`

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    const length = Number(form.serialLength)
    const units = Number(form.unitsPerBooklet)
    if (form.name.trim().length < 3) next.name = 'Enter the form name.'
    if (!/^[A-Za-z0-9-]{0,6}$/.test(form.prefix)) next.prefix = 'Up to 6 letters, digits or hyphens.'
    if (!Number.isInteger(length) || length < 3 || length > 10) next.serialLength = 'Use a whole number from 3 to 10.'
    if (!Number.isInteger(units) || units < 1 || units > 1000) next.unitsPerBooklet = 'Use a whole number from 1 to 1,000.'
    setErrors(next)
    if (Object.keys(next).length) return
    update.mutate(
      { id: type.id, input: { name: form.name.trim(), prefix: form.prefix.trim(), serialLength: length, unitsPerBooklet: units } },
      { onSuccess: (ft) => toast.success(`${ft.shortName} saved.`) },
    )
  }

  const example = `${form.prefix}${'0'.repeat(Math.max(0, (Number(form.serialLength) || 0) - 1))}1`

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader>
          <div>
            <CardTitle as="h3">{type.shortName}</CardTitle>
            <CardDescription>
              Serial example: <span className="font-mono">{example}</span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Form name" htmlFor={`${id}-name`} error={errors.name} className="sm:col-span-2">
            <Input id={`${id}-name`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Prefix" htmlFor={`${id}-prefix`} error={errors.prefix} hint="Leave blank if serials are numbers only.">
            <Input id={`${id}-prefix`} className="font-mono" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} aria-invalid={Boolean(errors.prefix)} />
          </Field>
          <Field label="Serial length (digits)" htmlFor={`${id}-len`} error={errors.serialLength}>
            <Input id={`${id}-len`} inputMode="numeric" className="num" value={form.serialLength} onChange={(e) => setForm({ ...form, serialLength: e.target.value })} aria-invalid={Boolean(errors.serialLength)} />
          </Field>
          <Field label="Units per booklet" htmlFor={`${id}-units`} error={errors.unitsPerBooklet}>
            <Input id={`${id}-units`} inputMode="numeric" className="num" value={form.unitsPerBooklet} onChange={(e) => setForm({ ...form, unitsPerBooklet: e.target.value })} aria-invalid={Boolean(errors.unitsPerBooklet)} />
          </Field>
        </CardBody>
        <CardFooter>
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? t.common.saving : t.common.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
