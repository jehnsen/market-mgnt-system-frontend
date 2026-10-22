'use client'

import * as React from 'react'

export function useMediaQuery(query: string, fallback = true): boolean {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    [query],
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => fallback,
  )
}

export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
