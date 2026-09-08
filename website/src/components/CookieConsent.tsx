'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getDictionary } from '@/i18n/dictionary'
import { localePath, type Locale } from '@/i18n/locale'
import { CONSENT_KEY, writeConsent } from '@/lib/analytics'

/**
 * Cookie / measurement consent (website.md §8: "cookie consent where required
 * by jurisdiction").
 *
 * The analytics vendor behind it is a stub, but the consent GATE is real and
 * built the right way round: nothing is stored and no event recorded until the
 * visitor accepts. `track()` in lib/analytics.ts checks the same flag, so a
 * future vendor cannot be added without passing through this decision.
 * Declining is a first-class button, not a link behind "manage preferences" —
 * consent that is harder to refuse than to give is not consent.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS RENDERS SERVER-SIDE AND HIDES WITH CSS
 * ---------------------------------------------------------------------------
 * The obvious build is `useEffect` → read localStorage → render the banner if
 * undecided. That is what this component used to do, and it cost the landing
 * page its LCP budget: a large fixed text block that first paints after
 * hydration becomes the Largest Contentful Paint, so LCP was pinned to
 * whenever React finished booting — measured at 3.6s on throttled mobile
 * against a 2.5s requirement. The banner was not slow; it was late, and late
 * is what LCP measures.
 *
 * So the markup is server-rendered on every page and its visibility is decided
 * before first paint by a tiny blocking script in the root layout, which sets
 * `data-consent-pending` on <html> when localStorage holds no decision. The
 * banner is then part of the same paint as everything else: no late LCP
 * candidate, and no flash of a banner for someone who already chose.
 *
 * `hidden` is not used for this, because a `hidden` element is not rendered at
 * all and would reintroduce the late paint the moment it was revealed.
 * ---------------------------------------------------------------------------
 */

/** Kept in sync with the inline script in each root layout. */
export const CONSENT_PENDING_ATTR = 'data-consent-pending'

export const consentBootScript = `try{if(!localStorage.getItem(${JSON.stringify(
  CONSENT_KEY,
)}))document.documentElement.setAttribute(${JSON.stringify(
  CONSENT_PENDING_ATTR,
)},"1")}catch(e){document.documentElement.setAttribute(${JSON.stringify(
  CONSENT_PENDING_ATTR,
)},"1")}`

export function CookieConsent({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const [decided, setDecided] = useState(false)

  if (decided) return null

  const decide = (value: 'accepted' | 'declined') => {
    writeConsent(value)
    document.documentElement.removeAttribute(CONSENT_PENDING_ATTR)
    setDecided(true)
  }

  return (
    <div
      id="consent-banner"
      role="region"
      aria-label={dict.consent.title}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper/95 backdrop-blur-md"
    >
      <div className="wrap flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        {/* Width-constrained so this compliance notice can never be the
            page's largest text block — LCP should be measured against the
            content the visitor came for, not the cookie banner. */}
        <p className="max-w-measure text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-ink">{dict.consent.title}.</span>{' '}
          {dict.consent.body}{' '}
          <Link
            href={localePath(locale, '/privacy')}
            className="underline underline-offset-2 hover:text-ink"
          >
            {dict.consent.more}
          </Link>
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide('declined')}
            className="rounded-full border border-ink/20 px-5 py-2 text-[13px] font-medium text-ink transition hover:border-ink/50"
          >
            {dict.consent.decline}
          </button>
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-paper transition hover:bg-ink/85"
          >
            {dict.consent.accept}
          </button>
        </div>
      </div>
    </div>
  )
}
