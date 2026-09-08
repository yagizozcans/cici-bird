'use client'

import Link from 'next/link'
import { SpeciesArtwork } from './SpeciesArtwork'
import { AudioPlayer } from './AudioPlayer'
import { getDictionary } from '@/i18n/dictionary'
import { localePath, type Locale } from '@/i18n/locale'
import { speciesName, type Species } from '@/data/species'
import type { PlayableAudio } from '@/data/audio-manifest'

/**
 * One species in the catalog grid.
 *
 * The card answers, in order, the three questions a visitor actually has:
 * what does it sound like, can I go and find it, and what does it cost if I
 * cannot. §5 requires the findable-versus-purchase-only distinction to be
 * visible here rather than one click deeper, because that distinction is what
 * turns the catalog from a price list into a to-do list.
 *
 * A species whose voice is not trained yet (`ready === false`) answers none of
 * those honestly, so it answers a fourth question instead: not yet. It keeps
 * its place in the grid — the catalog is the roadmap, and hiding the seven
 * would misrepresent the size of it — but it loses the two things that would
 * pass a placeholder off as the bird: the sample, and the link to a page of
 * measurements taken on a hand-authored voice.
 *
 * The play button is deliberately NOT inside the card's link. Nesting a button
 * in an anchor is invalid and, worse, makes "play the sample" and "leave this
 * page" the same gesture on a phone.
 */
export function SpeciesCard({
  species,
  locale,
  sample,
  ready,
}: {
  species: Species
  locale: Locale
  sample: PlayableAudio | null
  ready: boolean
}) {
  const dict = getDictionary(locale)
  const name = speciesName(species, locale)
  const findable = species.unlock.findable

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl2 border border-line transition ${
        ready
          ? 'bg-white/60 hover:border-ink/25 hover:shadow-[0_12px_40px_-28px_rgba(22,21,15,0.4)]'
          : 'bg-white/35'
      }`}
    >
      <div className="relative aspect-[2/1] overflow-hidden border-b border-line">
        <SpeciesArtwork
          species={species}
          locale={locale}
          className={`h-full w-full ${ready ? '' : 'opacity-45 saturate-[0.35]'}`}
        />

        <span
          className="absolute left-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink backdrop-blur-sm"
          style={{ boxShadow: `inset 0 0 0 1px ${species.palette.accent}55` }}
        >
          {dict.species.tierNames[species.tier]}
        </span>

        {!ready && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-paper backdrop-blur-sm">
            {dict.catalog.soon}
          </span>
        )}

        {ready && sample && (
          <div className="absolute bottom-3 right-3">
            <AudioPlayer
              audio={sample}
              label={`${dict.catalog.listen}: ${name}`}
              variant="button"
              playLabel={dict.demo.play}
              pauseLabel={dict.demo.pause}
              analyticsEvent="sample_play"
              analyticsProps={{ species: species.slug, surface: 'catalog' }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* h2, not h3: these sit directly beneath the catalog page's h1,
            and a skipped level makes the page unnavigable by headings. */}
        <h2
          className={`text-[15px] font-semibold tracking-tight ${
            ready ? 'text-ink' : 'text-ink/60'
          }`}
        >
          {ready ? (
            // The whole card is the link target via ::after, so the tap area on
            // a phone is the card and not just the eleven-pixel-tall name.
            <Link
              href={localePath(locale, `/species/${species.slug}`)}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </h2>
        <p className="mt-0.5 text-[12px] italic text-muted">
          {species.scientificName}
        </p>

        <p
          className={`mt-3 line-clamp-2 text-[13px] leading-relaxed ${
            ready ? 'text-ink/75' : 'text-ink/50'
          }`}
        >
          {species.habitat[locale] || species.habitat.en}
        </p>

        {ready ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                findable ? 'text-moss' : 'text-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  findable ? 'bg-moss' : 'bg-muted/50'
                }`}
              />
              {findable ? dict.catalog.findable : dict.catalog.purchaseOnly}
            </span>
            <span className="text-[11px] text-muted">
              {species.seasons.length === 4
                ? dict.seasons.yearRound
                : species.seasons.map((s) => dict.seasons[s]).join(' · ')}
            </span>
          </div>
        ) : (
          // The disclaimer replaces the findable/price row rather than joining
          // it: what a locked voice costs and where to find it are answers to
          // questions that only start mattering once it exists.
          <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
            <span className="font-semibold uppercase tracking-[0.08em] text-ink/70">
              {dict.catalog.soon}
            </span>{' '}
            — {dict.catalog.soonNote}
          </p>
        )}
      </div>
    </article>
  )
}
