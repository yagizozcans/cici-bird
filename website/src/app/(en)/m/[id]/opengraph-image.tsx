import { speciesOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og'
import { lookupMessage } from '@/data/messages'
import { getSpecies, speciesName } from '@/data/species'
import { getDictionary } from '@/i18n/dictionary'
import { ImageResponse } from 'next/og'

/**
 * The link preview for a shared birdsong message (website.md §4).
 *
 * WHAT THIS CARD DELIBERATELY OMITS: the message text. A preview image is
 * fetched and cached by whatever platform the link was pasted into and by
 * link-unrolling bots the sender never chose, so putting the decoded message
 * in it would publish private content to services outside our control — and
 * would do it for expired and revoked links too, since previews are often
 * fetched once and kept. The card carries the species name and artwork, which
 * is exactly what §4 asks for and nothing more.
 */

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'A birdsong message'

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const lookup = lookupMessage(id)
  const dict = getDictionary('en')

  if (lookup.kind === 'missing') return fallbackCard(dict.message.missingTitle)

  const species = getSpecies(lookup.message.speciesSlug)
  if (!species) return fallbackCard(dict.message.badge)

  const unavailable = lookup.kind !== 'found'
  return speciesOgImage({
    species,
    name: speciesName(species, 'en'),
    eyebrow: dict.message.badge,
    // A dead link says so on the card, so the recipient learns it before
    // opening. A live one shows only the binomial — never the message text.
    headline: unavailable
      ? lookup.kind === 'expired'
        ? dict.message.expiredTitle
        : dict.message.revokedTitle
      : species.scientificName,
    footnote: unavailable ? undefined : dict.message.replyTitle,
  })
}

/** No species to draw, so the card falls back to the wordmark and a status. */
function fallbackCard(title: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#FBFAF7',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#6B675C', letterSpacing: 3 }}>
          CICI BIRD
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 700,
            color: '#16150F',
            marginTop: 22,
            letterSpacing: -2,
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#B8791B', marginTop: 28 }}>
          cicibird.com
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
