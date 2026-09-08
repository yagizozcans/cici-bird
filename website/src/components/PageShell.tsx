import { Header } from './Header'
import { Footer } from './Footer'
import { CookieConsent } from './CookieConsent'
import { JsonLd } from './JsonLd'
import { graph, organizationLd, websiteLd } from '@/lib/jsonld'
import type { Locale } from '@/i18n/locale'

/**
 * The frame every page renders inside, below <body>.
 *
 * `path` is the CANONICAL ENGLISH path of the current page (e.g.
 * '/species/nightingale', never '/tr/species/nightingale'). The language
 * switch prefixes it per locale, so switching language lands on the same page
 * in the other language rather than dumping the visitor at the home page.
 */
export function PageShell({
  locale,
  path,
  children,
}: {
  locale: Locale
  path: string
  children: React.ReactNode
}) {
  return (
    <>
      <JsonLd json={graph([organizationLd(), websiteLd(locale)])} />
      <Header locale={locale} path={path} />
      <main id="main">{children}</main>
      <Footer locale={locale} />
      <CookieConsent locale={locale} />
    </>
  )
}
