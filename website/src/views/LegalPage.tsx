import { PageShell } from '@/components/PageShell'
import { getDictionary } from '@/i18n/dictionary'
import { LOCALE_TAG, type Locale } from '@/i18n/locale'
import { SITE } from '@/lib/site'

/**
 * The frame for the four legally-required documents (website.md §6).
 *
 * Two banners, both deliberate:
 *
 *  1. THE REVIEW BANNER is unmissable and stays until a lawyer signs off.
 *     §6 is explicit that these pages "are drafted from templates but must not
 *     ship as templates", and the failure mode it is guarding against is a
 *     draft quietly becoming the live policy because nobody remembered it was
 *     a draft. It is loud on purpose.
 *
 *  2. THE TRANSLATION BANNER appears on the Turkish routes. The document body
 *     is served in English in both trees, because an unreviewed machine
 *     translation of a privacy policy is a worse artefact than an English one
 *     with an honest notice — it reads as authoritative and is not. Turkish
 *     versions are a launch prerequisite for the Türkiye market, tracked in
 *     website/README.md, not something to fake here.
 */
export function LegalPage({
  locale,
  path,
  title,
  lede,
  lastUpdated,
  contactEmail = SITE.contact.legal,
  children,
}: {
  locale: Locale
  path: string
  title: string
  lede?: string
  lastUpdated: string
  contactEmail?: string
  children: React.ReactNode
}) {
  const dict = getDictionary(locale)
  const formattedDate = new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(lastUpdated))

  return (
    <PageShell locale={locale} path={path}>
      <article className="wrap max-w-3xl py-10 sm:py-14">
        <div
          role="note"
          className="rounded-xl2 border-2 border-amber-400 bg-amber-50 px-5 py-4"
        >
          <p className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-amber-900">
            {dict.legal.reviewBanner}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-amber-900/90">
            {dict.legal.reviewBannerBody}
          </p>
        </div>

        {locale === 'tr' && (
          <p className="mt-4 rounded-lg border border-line bg-white/60 px-4 py-3 text-[13px] leading-relaxed text-muted">
            {dict.legal.trTranslationBanner}
          </p>
        )}

        <header className="mt-10">
          <h1 className="text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">
            {title}
          </h1>
          {lede && (
            <p className="mt-4 max-w-measure text-[16px] leading-relaxed text-muted">
              {lede}
            </p>
          )}
          <p className="mt-5 border-t border-line pt-4 text-[12px] text-muted">
            {dict.legal.lastUpdated}:{' '}
            <time dateTime={lastUpdated}>{formattedDate}</time>
          </p>
        </header>

        <div className="prose-doc mt-8">{children}</div>

        <footer className="mt-14 border-t border-line pt-6">
          <p className="text-[13px] text-muted">
            {dict.legal.contact}:{' '}
            <a
              href={`mailto:${contactEmail}`}
              className="text-ochre-deep underline underline-offset-2 hover:text-ink"
            >
              {contactEmail}
            </a>
          </p>
        </footer>
      </article>
    </PageShell>
  )
}
