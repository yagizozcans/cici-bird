import Link from 'next/link'
import { getDictionary } from '@/i18n/dictionary'
import { localePath, type Locale } from '@/i18n/locale'
import { Wordmark } from './Wordmark'
import { LanguageSwitch } from './LanguageSwitch'

/**
 * Site header.
 *
 * Deliberately thin: on a phone arriving from a shared link, every pixel above
 * the demo is a pixel of persuasion lost. The nav is three short links and
 * the language switch, no hamburger.
 *
 * MEASURED (2026-09-08, adding Lab): at 375 px the row fits inside the wrap
 * padding to the pixel in both languages, but only with the tighter spacing
 * below `sm` on NavLink and the nav gap — at the desktop spacing it overran by
 * 43 px. At 320 px it overflows by ~40–60 px, and it did so before Lab
 * existed too (two links + switch were already 230 px into 186 px), so 375 is
 * the floor this header actually holds. A fourth link, or a 320 px target,
 * earns a menu; do not add either without one.
 */
export function Header({ locale, path }: { locale: Locale; path: string }) {
  const dict = getDictionary(locale)

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-[13px] focus:text-paper"
      >
        {dict.nav.skipToContent}
      </a>

      <div className="wrap flex h-14 items-center justify-between gap-4">
        {/* No aria-label here on purpose. The wordmark carries its own
            sr-only "CICI BIRD", so an aria-label would REPLACE the visible
            text with something that does not match it — which breaks
            voice-control users, who say what they can see. */}
        <Link href={localePath(locale, '/')} className="shrink-0 rounded-sm">
          <Wordmark />
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-2" aria-label="Primary">
          <NavLink href={localePath(locale, '/species')}>{dict.nav.species}</NavLink>
          <NavLink href={localePath(locale, '/lab')}>{dict.nav.lab}</NavLink>
          <NavLink href={localePath(locale, '/support')}>{dict.nav.support}</NavLink>
          <LanguageSwitch locale={locale} path={path} />
        </nav>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-2 py-1.5 text-[12px] text-muted transition hover:bg-line/40 hover:text-ink sm:px-3 sm:text-[13px]"
    >
      {children}
    </Link>
  )
}
