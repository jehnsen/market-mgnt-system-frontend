import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Public_Sans } from 'next/font/google'
import { Providers } from '@/components/providers'
import { lguConfig } from '@/config/lgu'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-jakarta', display: 'swap' })
const publicSans = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-public-sans', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'MARCIS', template: '%s · MARCIS' },
  description: `Market Administration, Revenue, Collection & Inventory System — ${lguConfig.municipality}, ${lguConfig.province}`,
  icons: { icon: '/seal.svg' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f6f5' },
    { media: '(prefers-color-scheme: dark)', color: '#081b1d' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${publicSans.variable} ${plexMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
