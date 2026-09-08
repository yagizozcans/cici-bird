import Link from 'next/link'
import { LOCALES, LOCALE_LABEL, localePath, stripLocale, type Locale } from '@/i18n/locale'

/**
 * EN / TR switch.
 *
 * Renders as real links to the other language's URL, not a client-side state
 * toggle. That is the whole reason the /tr tree exists: a language a visitor
 * can link to, a crawler can follow, and hreflang can point at.
 *
 * `path` is the canonical English path of the current page, so switching
 * language keeps you on the same page instead of dropping you at the home page.
 */
export function LanguageSwitch({ locale, path }: { locale: Locale; path: string }) {
  const canonical = stripLocale(path)

  return (
    <div className="ml-1 flex items-center rounded-full border border-line p-0.5">
      {LOCALES.map((code) => {
        const active = code === locale
        return (
          <Link
            key={code}
            href={localePath(code, canonical)}
            hrefLang={code}
            aria-current={active ? 'true' : undefined}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition ${
              active ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
            }`}
          >
            <span aria-hidden="true">{code}</span>
            <span className="sr-only">{LOCALE_LABEL[code]}</span>
          </Link>
        )
      })}
    </div>
  )
}
