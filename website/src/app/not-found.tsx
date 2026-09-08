import Link from 'next/link'
import './globals.css'
import { getDictionary } from '@/i18n/dictionary'

/**
 * The global 404.
 *
 * This file sits ABOVE both root layouts, so it renders its own <html> and
 * <body> — with two root layouts in route groups there is no shared shell for
 * it to inherit. It stays deliberately plain: no header, no footer, no
 * dictionary switching, because an unmatched URL carries no locale to switch
 * to and this page's only job is to offer two working links.
 */
export default function NotFound() {
  const dict = getDictionary('en')

  return (
    <html lang="en">
      <body>
        <main className="wrap flex min-h-screen max-w-2xl flex-col justify-center py-20">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">
            404
          </p>
          <h1 className="mt-4 text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">
            {dict.notFound.title}
          </h1>
          <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
            {dict.notFound.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition hover:bg-ink/85"
            >
              {dict.notFound.home}
            </Link>
            <Link
              href="/species"
              className="rounded-full border border-ink/20 px-5 py-2.5 text-[13px] font-medium text-ink transition hover:border-ink/50"
            >
              {dict.notFound.species}
            </Link>
          </div>
        </main>
      </body>
    </html>
  )
}
