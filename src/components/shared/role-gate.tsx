'use client'

import * as React from 'react'
import { can, type Permission } from '@/lib/permissions'
import { useSession } from '@/lib/session'
import { NoAccess } from './states'

/** Render children only when the current role has the permission. */
export function RoleGate({
  permission,
  children,
  fallback = null,
  page,
}: {
  permission: Permission | Permission[]
  children: React.ReactNode
  fallback?: React.ReactNode
  /** When true, show a full "no access" message instead of rendering nothing. */
  page?: string
}) {
  const { role } = useSession()
  const perms = Array.isArray(permission) ? permission : [permission]
  const allowed = perms.some((p) => can(role, p))
  if (allowed) return <>{children}</>
  if (page) return <NoAccess what={page} />
  return <>{fallback}</>
}

export function useCan() {
  const { role } = useSession()
  return React.useCallback((p: Permission) => can(role, p), [role])
}
