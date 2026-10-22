'use client'

import * as React from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Checkbox } from '@/components/ui/controls'
import { Field, fieldA11y, Label } from '@/components/ui/form-field'
import { Input, Textarea } from '@/components/ui/input'
import type { LesseeInput } from '@/lib/api'

export const lesseeSchema = z.object({
  firstName: z.string().trim().min(2, 'Enter the first name.').max(60),
  middleInitial: z.string().trim().max(2, 'Use one or two letters.'),
  lastName: z.string().trim().min(2, 'Enter the last name.').max(60),
  businessName: z.string().trim().max(80),
  contactNumber: z
    .string()
    .trim()
    .regex(/^(\+63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}$/, 'Use a Philippine mobile number, e.g. 0917 555 1234.'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email or leave it blank.')]),
  address: z.string().trim().min(5, 'Enter the barangay and municipality.'),
  smsConsent: z.boolean(),
  notes: z.string().trim().max(500),
})

export const emptyLessee: LesseeInput = { firstName: '', middleInitial: '', lastName: '', businessName: '', contactNumber: '', email: '', address: '', smsConsent: false, notes: '' }

/** Lessee fields. Used on its own pages and inside the new-lease wizard. */
export function LesseeForm({
  defaultValues = emptyLessee,
  onSubmit,
  formId,
  children,
}: {
  defaultValues?: LesseeInput
  onSubmit: (values: LesseeInput) => void
  formId: string
  children?: React.ReactNode
}) {
  const form = useForm<LesseeInput>({ resolver: zodResolver(lesseeSchema), defaultValues })
  const e = form.formState.errors
  const consent = useWatch({ control: form.control, name: 'smsConsent' })
  const p = formId
  return (
    <form id={formId} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem_1fr]">
        <Field label="First name" htmlFor={`${p}-first`} error={e.firstName?.message}>
          <Input autoComplete="off" {...fieldA11y(`${p}-first`, e.firstName?.message)} {...form.register('firstName')} />
        </Field>
        <Field label="M.I." htmlFor={`${p}-mi`} error={e.middleInitial?.message} optional>
          <Input maxLength={2} {...fieldA11y(`${p}-mi`, e.middleInitial?.message)} {...form.register('middleInitial')} />
        </Field>
        <Field label="Last name" htmlFor={`${p}-last`} error={e.lastName?.message}>
          <Input autoComplete="off" {...fieldA11y(`${p}-last`, e.lastName?.message)} {...form.register('lastName')} />
        </Field>
      </div>
      <Field label="Business name" htmlFor={`${p}-biz`} optional error={e.businessName?.message}>
        <Input {...fieldA11y(`${p}-biz`, e.businessName?.message)} {...form.register('businessName')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile number" htmlFor={`${p}-phone`} error={e.contactNumber?.message} hint="Used for SMS reminders if the lessee agrees.">
          <Input type="tel" inputMode="tel" placeholder="0917 555 1234" {...fieldA11y(`${p}-phone`, e.contactNumber?.message, true)} {...form.register('contactNumber')} />
        </Field>
        <Field label="Email" htmlFor={`${p}-email`} optional error={e.email?.message}>
          <Input type="email" {...fieldA11y(`${p}-email`, e.email?.message)} {...form.register('email')} />
        </Field>
      </div>
      <Field label="Address" htmlFor={`${p}-addr`} error={e.address?.message}>
        <Input placeholder="Brgy. Ilaya (Pob.), Pontevedra, Capiz" {...fieldA11y(`${p}-addr`, e.address?.message)} {...form.register('address')} />
      </Field>
      <div className="flex gap-3 rounded-md border border-border bg-surface-muted/60 p-3">
        <Checkbox id={`${p}-consent`} checked={consent} onCheckedChange={(v) => form.setValue('smsConsent', Boolean(v), { shouldDirty: true })} className="mt-0.5" aria-describedby={`${p}-consent-desc`} />
        <div>
          <Label htmlFor={`${p}-consent`}>The lessee agrees to receive SMS reminders</Label>
          <p id={`${p}-consent-desc`} className="mt-0.5 text-[13px] text-ink-muted">
            Payment and lease-renewal reminders from the Municipal Treasurer&apos;s Office. Only lessees who agreed appear as SMS recipients. They can withdraw consent at any time.
          </p>
        </div>
      </div>
      <Field label="Notes" htmlFor={`${p}-notes`} optional error={e.notes?.message}>
        <Textarea rows={3} {...fieldA11y(`${p}-notes`, e.notes?.message)} {...form.register('notes')} />
      </Field>
      {children}
    </form>
  )
}
