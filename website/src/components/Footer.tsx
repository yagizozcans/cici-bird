import Link from 'next/link'
import { getDictionary } from '@/i18n/dictionary'
import { localePath, type Locale } from '@/i18n/locale'
import { SITE } from '@/lib/site'
import { Wordmark } from './Wordmark'

export function Footer({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const p = (path: string) => localePath(locale, path)

  return (
    <footer className="mt-24 border-t border-line bg-white/40">
      <div className="wrap grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Wordmark />
          <p className="mt-3 max-w-[28ch] text-[13px] leading-relaxed text-muted">
            {dict.hero.oneLiner}
          </p>
        </div>

        <FooterColumn title={dict.footer.product}>
          <FooterLink href={p('/species')}>{dict.nav.species}</FooterLink>
          <FooterLink href={p('/lab')}>{dict.nav.lab}</FooterLink>
          <FooterLink href={p('/#how-it-works')}>{dict.nav.howItWorks}</FooterLink>
          <FooterLink href={p('/support')}>{dict.nav.support}</FooterLink>
        </FooterColumn>

        <FooterColumn title={dict.footer.legal}>
          <FooterLink href={p('/privacy')}>Privacy</FooterLink>
          <FooterLink href={p('/terms')}>Terms</FooterLink>
          <FooterLink href={p('/data-request')}>Data requests</FooterLink>
        </FooterColumn>

        <FooterColumn title={dict.footer.company}>
          <li className="text-[13px] text-muted">{dict.footer.house}</li>
          {/*
            The ONLY reference to cicicv.com on this site. CICI CV is a sibling
            project under the same house, not this project's parent — so it
            appears here as a peer link and nowhere in any canonical URL, OG
            tag, sitemap entry or route.
          */}
          <li>
            <a
              href={SITE.house.sibling.url}
              rel="noopener"
              className="text-[13px] text-muted underline-offset-2 transition hover:text-ink hover:underline"
            >
              {dict.footer.sibling}: {SITE.house.sibling.name}
            </a>
          </li>
          <li>
            <a
              href={`mailto:${SITE.contact.support}`}
              className="text-[13px] text-muted underline-offset-2 transition hover:text-ink hover:underline"
            >
              {SITE.contact.support}
            </a>
          </li>
        </FooterColumn>
      </div>

      <div className="wrap flex flex-col gap-2 border-t border-line py-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {SITE.house.name}. {dict.footer.rights}
        </p>
        <p className="font-mono">{SITE.domain}</p>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/70">
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[13px] text-muted underline-offset-2 transition hover:text-ink hover:underline"
      >
        {children}
      </Link>
    </li>
  )
}
