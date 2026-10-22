'use client'

import * as React from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, fieldA11y } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

const schema = z.object({ email: z.string().trim().email('Enter a valid email address.') })

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const err = form.formState.errors.email?.message

  if (sentTo) {
    return (
      <div role="status">
        <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-money-in-soft text-money-in">
          <MailCheckIcon className="size-6" />
        </div>
        <h1 className="font-heading text-page font-semibold">Check your email</h1>
        <p className="mt-2 text-ink-muted">
          If <strong className="text-ink">{sentTo}</strong> belongs to a MARCIS account, a reset link is on its way. The link expires in 30 minutes.
        </p>
        <Button asChild variant="secondary" className="mt-8">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-heading text-page font-semibold">Reset your password</h1>
      <p className="mt-1 text-ink-muted">Enter your office email and we will send you a reset link.</p>
      <form
        noValidate
        className="mt-8 grid gap-4"
        onSubmit={form.handleSubmit(async ({ email }) => {
          await api.auth.requestReset(email)
          setSentTo(email)
        })}
      >
        <Field label="Email" htmlFor="email" error={err}>
          <Input type="email" autoComplete="email" {...fieldA11y('email', err)} {...form.register('email')} />
        </Field>
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link href="/login" className="text-center text-sm text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </form>
    </div>
  )
}
