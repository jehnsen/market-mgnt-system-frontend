import type { Api } from '../contracts'
import { accountableFormsService } from './accountableForms'
import { billingService } from './billing'
import { collectionsService } from './collections'
import { collectorsService } from './collectors'
import { dashboardService } from './dashboard'
import { leasesService } from './leases'
import { lesseesService } from './lessees'
import { messagesService } from './messages'
import { authService, notificationsService, searchService } from './misc'
import { reconciliationService } from './reconciliation'
import { reportsService } from './reports'
import { settingsService } from './settings'
import { stallsService } from './stalls'

export const mockApi: Api = {
  auth: authService,
  stalls: stallsService,
  lessees: lesseesService,
  leases: leasesService,
  collections: collectionsService,
  reconciliation: reconciliationService,
  accountableForms: accountableFormsService,
  billing: billingService,
  messages: messagesService,
  collectors: collectorsService,
  dashboard: dashboardService,
  reports: reportsService,
  settings: settingsService,
  notifications: notificationsService,
  search: searchService,
}

export { setActor, ApiError } from './util'
