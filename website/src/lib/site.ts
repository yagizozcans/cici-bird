/**
 * Single source of truth for the site's identity.
 *
 * CICI BIRD is a standalone project under the CICI house, and a SIBLING of
 * CICI CV — not a child of it. cicicv.com must never appear as this site's
 * origin, parent path or canonical host. It is referenced in exactly one
 * place: the footer's "part of CICI" line.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://cicibird.com'
).replace(/\/$/, '')

export const SITE = {
  name: 'CICI BIRD',
  wordmark: 'cici bird',
  domain: 'cicibird.com',
  url: SITE_URL,
  house: { name: 'CICI', sibling: { name: 'CICI CV', url: 'https://cicicv.com' } },
  contact: {
    support: 'support@cicibird.com',
    privacy: 'privacy@cicibird.com',
    legal: 'legal@cicibird.com',
  },
  // Store listings do not exist yet. Rendering these as dead links would be
  // worse than saying so, and the CTA components read `available` to decide
  // between a live link and an honest "not yet" state.
  stores: {
    ios: { url: 'https://apps.apple.com/app/cicibird', available: false },
    android: {
      url: 'https://play.google.com/store/apps/details?id=com.cici.bird',
      available: false,
    },
  },
} as const

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
