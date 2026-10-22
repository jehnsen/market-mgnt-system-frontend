'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

export default function VerifyPage() {
  const router = useRouter()
  const { ready, session, markVerified, signOut } = useSession()
  const [digits, setDigits] = React.useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const refs = React.useRef<(HTMLInputElement | null)[]>([])

  React.useEffect(() => {
    if (!ready) return
    if (!session) router.replace('/login')
    else if (session.verified) router.replace('/app')
  }, [ready, session, router])

  const code = digits.join('')

  const submit = async (value: string) => {
    if (!session) return
    setPending(true)
    setError(null)
    try {
      await api.auth.verify({ userId: session.userId, code: value })
      markVerified()
      router.replace('/app')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.')
      setDigits(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally {
      setPending(false)
    }
  }

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split('')
      const filled = [...next, ...Array(6 - next.length).fill('')]
      setDigits(filled)
      refs.current[Math.min(5, next.length)]?.focus()
      if (next.length === 6) void submit(next.join(''))
      return
    }
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) refs.current[i + 1]?.focus()
    if (next.every(Boolean)) void submit(next.join(''))
  }

  return (
    <div>
      <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <ShieldCheckIcon className="size-6" />
      </div>
      <h1 className="font-heading text-page font-semibold">2-step verification</h1>
      <p className="mt-1 text-ink-muted">
        Enter the 6-digit code from your authenticator app{session ? ` for ${session.user.email}` : ''}.
      </p>
      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length === 6) void submit(code)
          else setError('Enter all 6 digits.')
        }}
      >
        <fieldset>
          <legend className="sr-only">Verification code</legend>
          <div className="flex gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el
                }}
                value={d}
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={6}
                aria-label={`Digit ${i + 1} of 6`}
                aria-invalid={Boolean(error)}
                autoFocus={i === 0}
                className={cn('num h-12 w-full min-w-0 rounded-md border border-border-strong/70 bg-surface text-center text-xl font-semibold focus-visible:border-focus', error && 'border-money-short')}
              />
            ))}
          </div>
        </fieldset>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-money-short">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-[13px] text-ink-muted">Demo: any 6 digits except 000000.</p>
        )}
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>
          {pending ? 'Verifying…' : 'Verify and continue'}
        </Button>
        <Button
          variant="link"
          className="mt-4"
          onClick={() => {
            signOut()
            router.replace('/login')
          }}
        >
          Use a different account
        </Button>
      </form>
    </div>
  )
}
