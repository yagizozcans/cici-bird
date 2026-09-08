/**
 * Locale model.
 *
 * The required routes in website.md §2 are unprefixed (`/`, `/species`, ...),
 * so English keeps those exactly and Turkish is served from an additive `/tr`
 * tree. That is what lets canonical URLs and hreflang alternates both be
 * correct — a cookie- or query-driven language swap would give two languages
 * one URL, which search engines cannot index and which breaks the shared-link
 * path this site exists to serve.
 */
export const LOCALES = ['en', 'tr'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/** Prefix a route for a locale. English is unprefixed by design. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (locale === DEFAULT_LOCALE) return clean
  return clean === '/' ? '/tr' : `/tr${clean}`
}

/** Strip a locale prefix back to the canonical English path. */
export function stripLocale(path: string): string {
  return path.replace(/^\/tr(?=\/|$)/, '') || '/'
}

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
}

/** BCP-47 tags, used for <html lang>, hreflang and Intl formatting. */
export const LOCALE_TAG: Record<Locale, string> = {
  en: 'en',
  tr: 'tr-TR',
}
