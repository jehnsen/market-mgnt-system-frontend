/**
 * The single place the UI gets its API from. To switch to the Laravel
 * backend, implement `Api` over HTTP (e.g. ./http) and export it here.
 */
import type { Api } from './contracts'
import { mockApi } from './mock'

export const api: Api = mockApi

export { setActor, ApiError } from './mock'
export type * from './contracts'
