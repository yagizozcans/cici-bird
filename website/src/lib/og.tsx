import { ImageResponse } from 'next/og'
import { voiceSignatureDataUri } from './artwork'
import type { Species } from '@/data/species'
import { SITE } from './site'

/**
 * Open Graph card generation.
 *
 * website.md §4 requires the shared message page to preview "with the species
 * name and artwork", and that preview is the entire first impression for the
 * highest-converting path on the site — the recipient sees this card in a chat
 * app before they see the page.
 *
 * The card is composed rather than photographed: the same voice-signature
 * geometry the page renders, drawn from lib/artwork.ts, plus the species name.
 * Composing it here means there is no static OG asset to keep in sync, a ninth
 * species gets a correct card for free, and every image is served from
 * cicibird.com.
 *
 * Satori (which backs ImageResponse) supports a restricted subset of CSS — no
 * grid, no `gap` on block containers, every child of a multi-child element
 * needs an explicit display. The markup below is written to that subset
 * deliberately; it is not styled the way the rest of the site is.
 */

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

/** Height of the full-bleed voice signature strip at the foot of the card. */
const ARTWORK_HEIGHT = 300

const PAPER = '#FBFAF7'
const INK = '#16150F'
const MUTED = '#6B675C'

export function speciesOgImage({
  species,
  name,
  eyebrow,
  headline,
  footnote,
}: {
  species: Species
  name: string
  /** Small label above the name, e.g. the tier or "A birdsong message". */
  eyebrow: string
  /** Optional line under the name — the message text, or the scientific name. */
  headline?: string
  footnote?: string
}) {
  const artwork = voiceSignatureDataUri(species, {
    width: OG_SIZE.width,
    height: ARTWORK_HEIGHT,
    notes: 4,
  })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: PAPER,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top: identity and copy */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: OG_SIZE.height - ARTWORK_HEIGHT,
            padding: '52px 64px 30px 64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: species.palette.accent,
                marginRight: 14,
              }}
            />
            <div
              style={{
                fontSize: 22,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              {eyebrow}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: name.length > 22 ? 76 : 92,
              fontWeight: 700,
              letterSpacing: -3,
              color: INK,
              marginTop: 26,
              lineHeight: 1.05,
            }}
          >
            {name}
          </div>

          {headline && (
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                color: MUTED,
                marginTop: 20,
                lineHeight: 1.3,
              }}
            >
              {truncate(headline, 90)}
            </div>
          )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', fontSize: 26, color: INK, fontWeight: 600 }}>
              {SITE.domain}
            </div>
            {footnote && (
              <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>
                {footnote}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: the species' voice signature, full bleed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artwork}
          alt=""
          width={OG_SIZE.width}
          height={ARTWORK_HEIGHT}
          style={{ display: 'flex', width: OG_SIZE.width, height: ARTWORK_HEIGHT }}
        />
      </div>
    ),
    OG_SIZE,
  )
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}
