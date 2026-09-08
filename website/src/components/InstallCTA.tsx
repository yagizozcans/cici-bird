'use client'

import { SITE } from '@/lib/site'
import { getDictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'
import { track } from '@/lib/analytics'

/**
 * App Store / Google Play buttons.
 *
 * The app has not shipped, so neither store listing exists. Rendering two
 * confident download buttons that 404 would be worse than saying so — and the
 * conversion metric in website.md §9 is only meaningful once the links are
 * real. `SITE.stores[*].available` is the single switch: flip it when the
 * listings go live and every CTA on the site becomes a working link.
 */

export function InstallCTA({
  locale,
  size = 'default',
  placement,
  className = '',
}: {
  locale: Locale
  size?: 'default' | 'large'
  /** Where on the page this instance sits, for the aggregate CTA metric. */
  placement: string
  className?: string
}) {
  const dict = getDictionary(locale)
  const anyAvailable = SITE.stores.ios.available || SITE.stores.android.available

  const base =
    size === 'large'
      ? 'px-6 py-3.5 text-[15px]'
      : 'px-5 py-3 text-[14px]'

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <StoreButton
          available={SITE.stores.ios.available}
          href={SITE.stores.ios.url}
          label={SITE.stores.ios.available ? dict.install.ios : dict.install.soonIos}
          icon={<AppleIcon />}
          className={base}
          onClick={() => track('install_cta_click', { store: 'ios', placement })}
          primary
        />
        <StoreButton
          available={SITE.stores.android.available}
          href={SITE.stores.android.url}
          label={
            SITE.stores.android.available
              ? dict.install.android
              : dict.install.soonAndroid
          }
          icon={<PlayIcon />}
          className={base}
          onClick={() => track('install_cta_click', { store: 'android', placement })}
        />
      </div>
      {!anyAvailable && (
        <p className="mt-3 text-[12px] text-muted">{dict.install.unavailableNote}</p>
      )}
    </div>
  )
}

function StoreButton({
  available,
  href,
  label,
  icon,
  className,
  onClick,
  primary = false,
}: {
  available: boolean
  href: string
  label: string
  icon: React.ReactNode
  className: string
  onClick: () => void
  primary?: boolean
}) {
  const shared = `inline-flex items-center justify-center gap-2.5 rounded-full font-medium transition ${className}`

  if (!available) {
    return (
      <span
        aria-disabled="true"
        className={`${shared} cursor-not-allowed border border-line bg-line/30 text-muted`}
      >
        {icon}
        {label}
      </span>
    )
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className={
        primary
          ? `${shared} bg-ink text-paper hover:bg-ink/85`
          : `${shared} border border-ink/20 bg-paper text-ink hover:border-ink/50`
      }
    >
      {icon}
      {label}
    </a>
  )
}

function AppleIcon() {
  return (
    <svg width="15" height="18" viewBox="0 0 15 18" fill="currentColor" aria-hidden="true">
      <path d="M12.3 9.5c0-2 1.6-3 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2C.7 9.4 1.8 13 3.2 15c.7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.2ZM10.4 3.4c.5-.7.9-1.6.8-2.5-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.5 2.4-1.2Z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="15" height="17" viewBox="0 0 15 17" fill="currentColor" aria-hidden="true">
      <path d="M.8.7A1 1 0 0 0 .4 1.5v14a1 1 0 0 0 .4.8l7.5-7.8L.8.7Zm9 6.9L11.9 5 2.2.3l7.6 7.3Zm0 1.8-7.6 7.3 9.7-4.7-2.1-2.6Zm3.4-2.4-1.9-.9-2.3 2.4 2.3 2.4 1.9-.9c.9-.5.9-2.5 0-3Z" />
    </svg>
  )
}
