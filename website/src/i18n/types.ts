import type { Locale } from './locale'

/** A string that exists in both shipped languages. */
export type Localized = Record<Locale, string>

/** Pick the copy for a locale, falling back to English if a key is missing. */
export function t(value: Localized | undefined, locale: Locale): string {
  if (!value) return ''
  return value[locale] || value.en || ''
}
