'use client'

import * as React from 'react'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster, toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/menus'
import { AppContextProvider } from '@/lib/app-context'
import { SessionProvider } from '@/lib/session'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
        mutationCache: new MutationCache({
          onError: (error) => toast.error(error instanceof Error ? error.message : 'Something went wrong.'),
        }),
      }),
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <AppContextProvider>
            <TooltipProvider>
              {children}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  classNames: {
                    toast: 'border border-border bg-surface-raised text-ink shadow-pop',
                    description: 'text-ink-muted',
                  },
                }}
              />
            </TooltipProvider>
          </AppContextProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
