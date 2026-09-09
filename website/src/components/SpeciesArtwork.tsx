import { voiceSignatureSvg } from '@/lib/artwork'
import { speciesName, type Species } from '@/data/species'
import type { Locale } from '@/i18n/locale'

/**
 * Renders a species' voice signature inline.
 *
 * The geometry lives in lib/artwork.ts and is shared with the Open Graph image
 * generator, so a species' card, its page and its social preview are all
 * literally the same drawing. See that module for why the artwork is derived
 * from the synthesis parameters rather than illustrated.
 *
 * Inline SVG rather than an <img>: no network request on the critical path,
 * and the mark counts toward LCP the way text does rather than as a late image
 * decode. The markup comes from our own generator over our own data — there is
 * no untrusted input anywhere in the path.
 */
export function SpeciesArtwork({
  species,
  locale,
  className,
  variant = 'card',
}: {
  species: Species
  locale: Locale
  className?: string
  variant?: 'card' | 'hero'
}) {
  // ONE note at either size. The hero used to draw two, and because the note
  // is identical in every repeat that read as a duplicated image rather than
  // as a phrase — the same shape twice, gap in the middle. The wide OG card
  // still draws four, where the repeat reads as a run of song.
  const svg = voiceSignatureSvg(species, {
    width: 400,
    height: variant === 'hero' ? 260 : 200,
  })

  return (
    <span
      className={`block ${className ?? ''}`}
      role="img"
      // The name lives on this wrapper, not on the SVG, and it follows the
      // document language: an English label inside a Turkish page is read out
      // in the wrong language by a screen reader set to Turkish.
      aria-label={`${speciesName(species, locale)} — ${species.voiceNote[locale]}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
