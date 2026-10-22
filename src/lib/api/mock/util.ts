import { nowISO } from '@/lib/dates'
import { getDb, type Db, nextId } from '@/lib/mock/db'
import { can, type Permission } from '@/lib/permissions'
import type { AppNotification, AuditEntry, Role } from '@/types'
import { touch } from './derive'

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/* The mock needs to know who is acting so it can enforce roles and audit. */
interface Actor {
  name: string
  role: Role
}
let actor: Actor = { name: 'Leonora D. Villaflor', role: 'treasurer' }

export function setActor(next: Actor) {
  actor = next
}

export function currentActor(): Actor {
  return actor
}

export function requirePermission(permission: Permission) {
  if (!can(actor.role, permission)) {
    throw new ApiError('Your role is not allowed to do this.', 403)
  }
}

function latency(): Promise<void> {
  const ms = 200 + Math.floor(Math.random() * 400)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Simulated network round trip. Results are cloned so callers can't mutate the store. */
export async function respond<T>(fn: (db: Db) => T): Promise<T> {
  await latency()
  const db = getDb()
  return structuredClone(fn(db))
}

/** Run a mutation, bump the store version and return a clone of the result. */
export async function mutate<T>(fn: (db: Db) => T): Promise<T> {
  await latency()
  const db = getDb()
  const result = fn(db)
  touch(db)
  return structuredClone(result)
}

export function audit(db: Db, entry: Omit<AuditEntry, 'id' | 'at' | 'actorName' | 'actorRole'>) {
  db.audit.unshift({ ...entry, id: nextId(db, 'aud'), at: nowISO(), actorName: actor.name, actorRole: actor.role })
}

export function notify(db: Db, n: Omit<AppNotification, 'id' | 'at' | 'read'>) {
  db.notifications.unshift({ ...n, id: nextId(db, 'ntf'), at: nowISO(), read: false })
}

export function required<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new ApiError(`${what} not found`, 404)
  return value
}
