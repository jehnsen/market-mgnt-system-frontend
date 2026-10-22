'use client'

import * as React from 'react'
import { todayISO } from '@/lib/dates'
import type { ISODate, MarketScope } from '@/types'

interface AppContextState {
  market: MarketScope
  setMarket: (m: MarketScope) => void
  /** Business date the app is looking at (today unless a day was chosen). */
  date: ISODate
  isToday: boolean
  today: ISODate
  setDate: (d: ISODate | 'today') => void
}

const AppContext = React.createContext<AppContextState | null>(null)
const MARKET_KEY = 'marcis.market'

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [market, setMarketState] = React.useState<MarketScope>('all')
  const [chosen, setChosen] = React.useState<ISODate | null>(null)
  const [today, setToday] = React.useState<ISODate>(() => todayISO())

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MARKET_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setMarketState(stored)
    } catch {
      // ignore unavailable storage
    }
    // Keep "today" right if the app stays open past midnight.
    const id = window.setInterval(() => setToday(todayISO()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const value = React.useMemo<AppContextState>(() => {
    const date = chosen && chosen < today ? chosen : today
    return {
      market,
      setMarket: (m) => {
        setMarketState(m)
        try {
          window.localStorage.setItem(MARKET_KEY, m)
        } catch {
          // ignore
        }
      },
      date,
      isToday: date === today,
      today,
      setDate: (d) => setChosen(d === 'today' || d >= today ? null : d),
    }
  }, [market, chosen, today])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext(): AppContextState {
  const ctx = React.useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppContextProvider')
  return ctx
}
