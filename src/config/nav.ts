import {
  BarChart3Icon,
  BellIcon,
  CalculatorIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  MessageSquareTextIcon,
  ReceiptTextIcon,
  ScaleIcon,
  SettingsIcon,
  SmartphoneIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { t } from '@/i18n'
import type { Permission } from '@/lib/permissions'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  permission?: Permission
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  { label: t.nav.groups.overview, items: [{ href: '/app', label: t.nav.dashboard, icon: LayoutDashboardIcon }] },
  {
    label: t.nav.groups.market,
    items: [
      { href: '/app/stalls', label: t.nav.stalls, icon: LayoutGridIcon, permission: 'stalls.view' },
      { href: '/app/lessees', label: t.nav.lessees, icon: UsersIcon, permission: 'lessees.view' },
      { href: '/app/leases', label: t.nav.leases, icon: FileTextIcon, permission: 'leases.view' },
    ],
  },
  {
    label: t.nav.groups.revenue,
    items: [
      { href: '/app/collections', label: t.nav.collections, icon: ReceiptTextIcon, permission: 'collections.view' },
      { href: '/app/reconciliation', label: t.nav.reconciliation, icon: ScaleIcon, permission: 'recon.view' },
      { href: '/app/accountable-forms', label: t.nav.accountableForms, icon: FileSpreadsheetIcon, permission: 'forms.view' },
      { href: '/app/billing', label: t.nav.billing, icon: CalculatorIcon, permission: 'billing.view' },
    ],
  },
  {
    label: t.nav.groups.field,
    items: [
      { href: '/app/collectors', label: t.nav.collectors, icon: SmartphoneIcon, permission: 'collectors.view' },
      { href: '/app/messages', label: t.nav.messages, icon: MessageSquareTextIcon, permission: 'messages.view' },
    ],
  },
  {
    label: t.nav.groups.insights,
    items: [
      { href: '/app/reports', label: t.nav.reports, icon: BarChart3Icon, permission: 'reports.view' },
      { href: '/app/notifications', label: t.nav.notifications, icon: BellIcon },
    ],
  },
  { label: t.nav.groups.admin, items: [{ href: '/app/settings', label: t.nav.settings, icon: SettingsIcon, permission: 'settings.view' }] },
]

/** Breadcrumb labels for path segments. */
export const SEGMENT_LABEL: Record<string, string> = {
  app: 'Dashboard',
  stalls: t.nav.stalls,
  lessees: t.nav.lessees,
  leases: t.nav.leases,
  new: 'New',
  edit: 'Edit',
  collections: t.nav.collections,
  transient: 'Transient vendors',
  reconciliation: t.nav.reconciliation,
  report: 'Report of collections',
  'accountable-forms': t.nav.accountableForms,
  summary: 'Accountability summary',
  billing: t.nav.billing,
  arrears: 'Arrears aging',
  statements: 'Statements of account',
  notices: 'Demand notices',
  messages: t.nav.messages,
  collectors: t.nav.collectors,
  reports: t.nav.reports,
  notifications: t.nav.notifications,
  settings: t.nav.settings,
  users: 'Users & roles',
  markets: 'Markets & stalls',
  fees: 'Fee schedule',
  forms: 'Form types',
  sms: 'SMS',
  payments: 'Digital payments',
  branding: 'Branding',
  audit: 'Audit log',
  system: 'System status',
  print: 'Print preview',
}
