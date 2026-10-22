import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="num text-sm text-ink-muted">404</p>
      <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-ink-muted">The page you are looking for does not exist or was moved.</p>
      <Link href="/app" className="mt-2 text-primary underline underline-offset-4">
        Go to the dashboard
      </Link>
    </main>
  )
}
