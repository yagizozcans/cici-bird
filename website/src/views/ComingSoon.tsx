import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { getDictionary } from '@/i18n/dictionary'
import { localePath, type Locale } from '@/i18n/locale'

/**
 * Placeholder for the v1.1 routes.
 *
 * website.md §2 lists /account, /blog and /press as v1.1, and the build brief
 * is explicit that they must be a 404 or a coming-soon page and nothing more.
 * They are `noindex` (see each route's metadata) so an empty page never becomes
 * a thin-content search result, and they carry no CTA — there is nothing here
 * to convert on.
 *
 * /account in particular stays empty on purpose beyond the roadmap: §7's
 * constraint is that digital goods for the mobile app cannot be sold through
 * the website, so nothing here should grow toward a purchase flow.
 */
export function ComingSoon({
  locale,
  path,
  title,
  detail,
}: {
  locale: Locale
  path: string
  title: string
  detail: string
}) {
  const dict = getDictionary(locale)

  return (
    <PageShell locale={locale} path={path}>
      <section className="wrap max-w-2xl py-20 sm:py-28">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {dict.soon.title}
        </p>
        <h1 className="mt-4 text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">
          {title}
        </h1>
        <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
          {dict.soon.body}
        </p>
        <p className="mt-3 max-w-measure text-[15px] leading-relaxed text-muted">
          {detail}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={localePath(locale, '/')}
            className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition hover:bg-ink/85"
          >
            {dict.soon.back}
          </Link>
          <Link
            href={localePath(locale, '/species')}
            className="rounded-full border border-ink/20 px-5 py-2.5 text-[13px] font-medium text-ink transition hover:border-ink/50"
          >
            {dict.catalog.title}
          </Link>
        </div>
      </section>
    </PageShell>
  )
}
