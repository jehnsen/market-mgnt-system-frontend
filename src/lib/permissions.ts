import type { Role } from '@/types'

export type Permission =
  | 'dashboard.operational'
  | 'stalls.view'
  | 'stalls.manage'
  | 'lessees.view'
  | 'lessees.manage'
  | 'lessees.viewContact'
  | 'leases.view'
  | 'leases.manage'
  | 'collections.view'
  | 'collections.requestCorrection'
  | 'collections.approveCorrection'
  | 'recon.view'
  | 'recon.recordRemittance'
  | 'recon.mark'
  | 'recon.closeDay'
  | 'forms.view'
  | 'forms.manage'
  | 'billing.view'
  | 'billing.run'
  | 'billing.prepare'
  | 'billing.issueNotices'
  | 'messages.view'
  | 'messages.send'
  | 'collectors.view'
  | 'collectors.manage'
  | 'reports.view'
  | 'reports.all'
  | 'reports.export'
  | 'settings.view'
  | 'settings.users'
  | 'settings.markets'
  | 'settings.fees'
  | 'settings.forms'
  | 'settings.sms'
  | 'settings.branding'
  | 'settings.audit'
  | 'settings.system'

const MATRIX: Record<Role, Permission[]> = {
  treasurer: [
    'dashboard.operational',
    'stalls.view',
    'lessees.view',
    'lessees.viewContact',
    'leases.view',
    'collections.view',
    'collections.approveCorrection',
    'recon.view',
    'recon.recordRemittance',
    'recon.mark',
    'recon.closeDay',
    'forms.view',
    'forms.manage',
    'billing.view',
    'billing.run',
    'billing.prepare',
    'billing.issueNotices',
    'messages.view',
    'collectors.view',
    'reports.view',
    'reports.all',
    'reports.export',
    'settings.view',
    'settings.fees',
    'settings.forms',
    'settings.audit',
  ],
  treasury_staff: [
    'dashboard.operational',
    'stalls.view',
    'lessees.view',
    'lessees.viewContact',
    'leases.view',
    'collections.view',
    'recon.view',
    'recon.recordRemittance',
    'recon.mark',
    'forms.view',
    'forms.manage',
    'billing.view',
    'billing.prepare',
    'messages.view',
    'collectors.view',
    'reports.view',
    'reports.all',
    'reports.export',
  ],
  market_supervisor: [
    'dashboard.operational',
    'stalls.view',
    'stalls.manage',
    'lessees.view',
    'lessees.manage',
    'lessees.viewContact',
    'leases.view',
    'leases.manage',
    'collections.view',
    'collections.requestCorrection',
    'recon.view',
    'forms.view',
    'billing.view',
    'messages.view',
    'messages.send',
    'collectors.view',
    'collectors.manage',
    'reports.view',
    'reports.all',
    'reports.export',
  ],
  mayor: ['stalls.view', 'collections.view', 'recon.view', 'billing.view', 'leases.view', 'lessees.view', 'reports.view', 'reports.all', 'reports.export'],
  sb: ['reports.view', 'reports.export'],
  admin: [
    'stalls.view',
    'settings.view',
    'settings.users',
    'settings.markets',
    'settings.fees',
    'settings.forms',
    'settings.sms',
    'settings.branding',
    'settings.audit',
    'settings.system',
  ],
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return MATRIX[role].includes(permission)
}

export const ROLE_LABEL: Record<Role, string> = {
  treasurer: 'Municipal Treasurer',
  treasury_staff: 'Treasury Staff',
  market_supervisor: 'Market Supervisor',
  mayor: "Mayor's Office",
  sb: 'Sangguniang Bayan',
  admin: 'Administrator',
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  treasurer: 'Reconciles, approves corrections, closes days, runs billing and issues demand notices.',
  treasury_staff: 'Records remittances, manages accountable forms, prepares statements and notices.',
  market_supervisor: 'Manages stalls, lessees, leases, collectors and SMS reminders.',
  mayor: 'Read-only dashboards and reports.',
  sb: 'Read-only summary reports for fee reviews.',
  admin: 'Users and roles, markets, fee schedule, forms, SMS, branding and audit log.',
}

export const ROLES: Role[] = ['treasurer', 'treasury_staff', 'market_supervisor', 'mayor', 'sb', 'admin']

/** Roles that only see the read-only summary dashboard. */
export function isSummaryRole(role: Role | null | undefined) {
  return role === 'mayor' || role === 'sb'
}

/** SB sees only the summary-style reports. */
export const SB_REPORTS = ['sb-summary', 'monthly-collections', 'occupancy', 'arrears-aging', 'yearly-trend'] as const
