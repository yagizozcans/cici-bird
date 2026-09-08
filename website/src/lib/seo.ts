import type { Metadata } from 'next'
import { SITE, absoluteUrl } from './site'
import { DEFAULT_LOCALE, localePath, type Locale } from '@/i18n/locale'

/**
 * Metadata construction for every indexable page.
 *
 * Two things this centralises, both of which are easy to get wrong once and
 * then wrong everywhere:
 *
 *  - CANONICAL HOST. Every canonical, OG url and alternate is built from
 *    SITE_URL (cicibird.com). The sibling project cicicv.com is never an
 *    origin here, and this is the only place that could make it one.
 *
 *  - HREFLANG PAIRING. English lives at `/x`, Turkish at `/tr/x`. Both must
 *    list each other and themselves, or search engines treat them as
 *    duplicates rather than translations.
 */

export interface PageSeo {
  locale: Locale
  /** Canonical English path, e.g. '/species/nightingale'. No /tr prefix. */
  path: string
  title: string
  description: string
  /** Route-segment OG images (opengraph-image.tsx) win when this is omitted. */
  image?: { url: string; width: number; height: number; alt: string }
  /** Set for /m/:id — unguessable, revocable links must never be indexed. */
  noIndex?: boolean
  type?: 'website' | 'article'
}

export function buildMetadata(seo: PageSeo): Metadata {
  const canonicalPath = localePath(seo.locale, seo.path)
  const canonical = absoluteUrl(canonicalPath)

  const languages: Record<string, string> = {
    en: absoluteUrl(localePath('en', seo.path)),
    tr: absoluteUrl(localePath('tr', seo.path)),
    'x-default': absoluteUrl(localePath(DEFAULT_LOCALE, seo.path)),
  }

  // The root layouts declare a `%s — CICI BIRD` title template, so the <title>
  // tag must carry the BARE page title or the suffix lands twice. Open Graph
  // has no template mechanism, so its title is composed here in full.
  const isHome = seo.title === SITE.name
  const fullTitle = isHome ? SITE.name : `${seo.title} — ${SITE.name}`

  // The `images` key is OMITTED rather than set to undefined when no explicit
  // image is given. Next merges file-based metadata (a route's
  // opengraph-image.tsx) only into an openGraph object that does not already
  // carry an `images` key — present-but-undefined counts as "the author
  // decided", and silently drops every generated card.
  const image = seo.image ? { images: [seo.image] } : {}

  return {
    title: isHome ? { absolute: SITE.name } : seo.title,
    description: seo.description,
    alternates: {
      canonical,
      // Private links get no alternates: advertising a translated URL for a
      // page we are asking robots not to index is contradictory.
      languages: seo.noIndex ? undefined : languages,
    },
    robots: seo.noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true },
    openGraph: {
      type: seo.type ?? 'website',
      siteName: SITE.name,
      title: fullTitle,
      description: seo.description,
      url: canonical,
      locale: OG_LOCALE[seo.locale],
      ...image,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: seo.description,
      ...(seo.image ? { images: [seo.image.url] } : {}),
    },
  }
}

/** og:locale wants a language_TERRITORY pair, not a bare language tag. */
const OG_LOCALE: Record<Locale, string> = { en: 'en_US', tr: 'tr_TR' }

/** Shared sizing for every generated OG image. */
export const OG_SIZE = { width: 1200, height: 630 } as const
