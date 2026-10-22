import { BarChart3Icon, CalendarDaysIcon, GaugeIcon, LandmarkIcon, LayoutGridIcon, TimerResetIcon, TrendingUpIcon } from 'lucide-react'

export const REPORTS = [
  { slug: 'daily-collections', title: 'Daily collection report', description: 'Collections by collector and type for one day, with remittances and variance.', icon: CalendarDaysIcon },
  { slug: 'monthly-collections', title: 'Monthly collections by section', description: 'Each section and market by collection type, compared with the previous month.', icon: BarChart3Icon },
  { slug: 'collector-performance', title: 'Collector performance', description: 'Collections, shortage days and average sync delay per collector.', icon: GaugeIcon },
  { slug: 'occupancy', title: 'Occupancy and vacancy', description: 'Occupancy over 12 months, by section, and every vacant stall with days vacant.', icon: LayoutGridIcon },
  { slug: 'arrears-aging', title: 'Arrears aging', description: 'Unpaid rentals by age bucket for each section.', icon: TimerResetIcon },
  { slug: 'yearly-trend', title: 'Yearly income trend', description: 'Twelve months of market income, year over year.', icon: TrendingUpIcon },
  { slug: 'sb-summary', title: 'Summary for the Sangguniang Bayan', description: 'Collections, occupancy and arrears in one page, for fee reviews.', icon: LandmarkIcon },
] as const
