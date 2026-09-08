/**
 * Aggregate-only analytics (website.md §8).
 *
 * The constraint is "aggregate, non-identifying measurement, disclosed in the
 * privacy policy". This module is the enforcement point for that promise, not
 * just a wrapper: `track` accepts a fixed set of event names and a small,
 * typed property bag, so there is no code path through which a message id, a
 * link token or a free-text field can reach a vendor by accident.
 *
 * No provider is wired up. Until one is chosen, events go to a no-op sink in
 * production and the console in development. Whatever replaces the sink must
 * hold to the same three rules:
 *   1. no cookies and no persistent identifier before consent
 *   2. no personal data and no message content in any payload
 *   3. the vendor list in /privacy is updated in the same change
 */
export type AnalyticsEvent =
  | 'demo_play'            // landing hero demo played
  | 'demo_voice_switch'    // visitor compared a second bird voice
  | 'sample_play'          // a species sample played
  | 'message_play'         // a shared /m/:id message played
  | 'install_cta_click'    // any App Store / Google Play button
  | 'species_filter'       // catalog filter applied

type Props = Record<string, string | number | boolean>

/** Property values are clamped so a long free-text string cannot leak through. */
function sanitize(props?: Props): Props {
  if (!props) return {}
  const out: Props = {}
  for (const [key, value] of Object.entries(props)) {
    out[key] = typeof value === 'string' ? value.slice(0, 64) : value
  }
  return out
}

export function track(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === 'undefined') return
  if (!hasAnalyticsConsent()) return
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, sanitize(props))
  }
  // Production sink intentionally absent — see the module note above.
}

export const CONSENT_KEY = 'cicibird.consent.v1'
export type ConsentValue = 'accepted' | 'declined'

export function readConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    return raw === 'accepted' || raw === 'declined' ? raw : null
  } catch {
    // Private browsing and blocked storage both throw. Absent consent is
    // "not granted", which is the correct default anyway.
    return null
  }
}

export function writeConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value)
  } catch {
    /* nothing we can do, and nothing we should do about it */
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent() === 'accepted'
}
