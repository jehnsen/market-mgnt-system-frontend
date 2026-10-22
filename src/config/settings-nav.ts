import type { Permission } from '@/lib/permissions'

export const SETTINGS_NAV: { href: string; label: string; permission: Permission; description: string }[] = [
  { href: '/app/settings/users', label: 'Users & roles', permission: 'settings.users', description: 'Invite staff, change roles, deactivate accounts.' },
  { href: '/app/settings/markets', label: 'Markets, sections & stalls', permission: 'settings.markets', description: 'Sections, stall list and the floor plan grid editor.' },
  { href: '/app/settings/fees', label: 'Fee schedule', permission: 'settings.fees', description: 'Rates, penalty rule, ordinance basis and version history.' },
  { href: '/app/settings/forms', label: 'Accountable form types', permission: 'settings.forms', description: 'Receipt and ticket types, prefixes and serial length.' },
  { href: '/app/settings/sms', label: 'SMS', permission: 'settings.sms', description: 'Turn SMS on or off, sender name, templates, allowance.' },
  { href: '/app/settings/payments', label: 'Digital payments', permission: 'settings.view', description: 'Available in Phase 2.' },
  { href: '/app/settings/branding', label: 'Branding', permission: 'settings.branding', description: 'LGU name, province, market names and seal.' },
  { href: '/app/settings/audit', label: 'Audit log', permission: 'settings.audit', description: 'Every action: who, what, when, before and after.' },
  { href: '/app/settings/system', label: 'System status', permission: 'settings.system', description: 'Backups, storage and devices online.' },
]
