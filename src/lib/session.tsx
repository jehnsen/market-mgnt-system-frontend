'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setActor } from '@/lib/api'
import { nowISO } from '@/lib/dates'
import type { Role, Session, User } from '@/types'

const KEY = 'marcis.session'

interface SessionState {
  ready: boolean
  session: Session | null
  user: User | null
  role: Role | null
  signIn: (user: User, opts: { rememberMe: boolean; verified: boolean }) => void
  markVerified: () => void
  signOut: () => void
  /** Demo only: act as another role without signing out. */
  switchRole: (role: Role) => Promise<void>
}

const SessionContext = React.createContext<SessionState | null>(null)

function readStored(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.sessionStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Session) : null
    return parsed?.user ? parsed : null
  } catch {
    return null
  }
}

function writeStored(session: Session | null) {
  try {
    window.localStorage.removeItem(KEY)
    window.sessionStorage.removeItem(KEY)
    if (session) (session.rememberMe ? window.localStorage : window.sessionStorage).setItem(KEY, JSON.stringify(session))
  } catch {
    // Storage can be unavailable (private mode); the session then lasts for this tab only.
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = React.useState<Session | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    // Hydrate from storage after mount so server and client markup match.
    const stored = readStored()
    if (stored) setActor({ name: stored.user.name, role: stored.role })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(stored)
    setReady(true)
  }, [])

  const update = React.useCallback(
    (next: Session | null) => {
      if (next) setActor({ name: next.user.name, role: next.role })
      setSession(next)
      writeStored(next)
      void queryClient.invalidateQueries()
    },
    [queryClient],
  )

  const value = React.useMemo<SessionState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      role: session?.role ?? null,
      signIn: (u, { rememberMe, verified }) =>
        update({ userId: u.id, user: u, role: u.role, verified, rememberMe, startedAt: nowISO() }),
      markVerified: () => {
        if (session) update({ ...session, verified: true })
      },
      signOut: () => {
        writeStored(null)
        setSession(null)
        queryClient.clear()
      },
      switchRole: async (role) => {
        if (!session) return
        const users = await queryClient.fetchQuery({ queryKey: ['auth', 'demo-users'], queryFn: () => api.auth.demoUsers(), staleTime: Infinity })
        const target = users.find((u) => u.role === role) ?? { ...session.user, role }
        update({ ...session, userId: target.id, user: target, role })
      },
    }),
    [ready, session, update, queryClient],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionState {
  const ctx = React.useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
