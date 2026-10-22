'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import { Field, fieldA11y, Label } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { lguConfig } from '@/config/lgu'
import { t } from '@/i18n'
import { api } from '@/lib/api'
import { ROLE_LABEL } from '@/lib/permissions'
import { useSession } from '@/lib/session'

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  rememberMe: z.boolean(),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { signIn, session, ready } = useSession()
  const [error, setError] = React.useState<string | null>(null)
  const demo = useQuery({ queryKey: ['auth', 'demo-users'], queryFn: () => api.auth.demoUsers(), staleTime: Infinity })
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', rememberMe: true } })
  const { errors, isSubmitting } = form.formState
  const rememberMe = useWatch({ control: form.control, name: 'rememberMe' })

  React.useEffect(() => {
    if (ready && session?.verified) router.replace('/app')
  }, [ready, session, router])

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const { user, needsVerification } = await api.auth.login(values)
      signIn(user, { rememberMe: values.rememberMe, verified: !needsVerification })
      const next = new URLSearchParams(window.location.search).get('next')
      router.replace(needsVerification ? '/login/verify' : next && next.startsWith('/app') ? next : '/app')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.')
    }
  })

  return (
    <div>
      <div className="mb-8 lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lguConfig.sealPath} alt="" className="size-14" />
        <p className="mt-3 font-heading text-2xl font-bold tracking-[0.1em]">{t.app.name}</p>
        <p className="text-sm text-ink-muted">{t.app.tagline}</p>
      </div>
      <h1 className="font-heading text-page font-semibold">Sign in</h1>
      <p className="mt-1 text-ink-muted">{lguConfig.officeName} staff only.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-4">
        {error ? (
          <p role="alert" className="rounded-md border border-money-short/30 bg-money-short-soft px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="username" {...fieldA11y('email', errors.email?.message)} {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...fieldA11y('password', errors.password?.message)} {...form.register('password')} />
        </Field>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => form.setValue('rememberMe', Boolean(v))} />
            <Label htmlFor="remember" className="font-normal">
              Remember me
            </Label>
          </div>
          <Link href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <section aria-labelledby="demo-accounts" className="mt-10 rounded-lg border border-dashed border-border-strong p-4">
        <h2 id="demo-accounts" className="text-sm font-semibold">
          Demo accounts
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Pick one to fill the form. Any password of 6+ characters works; Treasurer and Administrator then ask for a 6-digit code.</p>
        <ul className="mt-3 grid gap-1">
          {demo.data?.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-muted"
                onClick={() => {
                  form.setValue('email', u.email, { shouldValidate: true })
                  form.setValue('password', 'demo-pass', { shouldValidate: true })
                }}
              >
                <span className="font-medium">{ROLE_LABEL[u.role]}</span>
                <span className="truncate text-ink-muted">{u.name}</span>
              </button>
            </li>
          )) ?? <li className="text-[13px] text-ink-muted">{t.common.loading}</li>}
        </ul>
      </section>
    </div>
  )
}
