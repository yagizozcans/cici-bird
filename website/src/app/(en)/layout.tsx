import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { SITE, SITE_URL } from '@/lib/site'
import { consentBootScript } from '@/components/CookieConsent'

/**
 * English root layout.
 *
 * There are two root layouts, one per language, in route groups — `(en)`
 * serving the unprefixed routes website.md §2 specifies, and `(tr)` serving
 * the additive /tr tree. This is what lets <html lang> be correct per language
 * while every page stays statically renderable: reading the locale from a
 * header or a cookie in a single shared layout would make every route
 * dynamic and put the §3 LCP budget out of reach.
 */

export const metadata: Metadata = {
  // Every relative OG image path resolves against this. It is cicibird.com and
  // nothing else — CICI BIRD is a sibling of cicicv.com, never a child.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE.name, template: `%s — ${SITE.name}` },
  description: 'Your voice, in birdsong.',
  applicationName: SITE.name,
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#FBFAF7',
  width: 'device-width',
  initialScale: 1,
}

export default function EnglishRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Runs before first paint and decides whether the consent banner is
          shown, so the banner is part of the initial paint rather than a late
          one that would define LCP. It is a fixed string built from a constant
          — no user input reaches it. See components/CookieConsent.tsx.
        */}
        <script dangerouslySetInnerHTML={{ __html: consentBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
