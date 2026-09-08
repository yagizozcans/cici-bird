import { PageShell } from '@/components/PageShell'
import { SpeciesCatalog } from '@/components/SpeciesCatalog'
import { JsonLd } from '@/components/JsonLd'
import { InstallCTA } from '@/components/InstallCTA'
import { getDictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'
import { allSpecies, hasTrainedVoice, speciesName, trainedMap } from '@/data/species'
import { toPlayable, type PlayableAudio } from '@/data/audio-manifest'
import { breadcrumbLd, graph } from '@/lib/jsonld'
import { absoluteUrl } from '@/lib/site'
import { localePath } from '@/i18n/locale'

/**
 * The species catalog (website.md §5).
 *
 * Two jobs, per the spec: browsing for prospective users, and SEO. The second
 * is why the full list is rendered server-side and the filters only hide from
 * it — an empty grid awaiting client state would index as an empty page.
 */
export function SpeciesCatalogPage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const species = allSpecies()
  const trained = trainedMap(species)
  const live = species.filter(hasTrainedVoice)

  // The catalog card plays the ENCODED sample rather than the real call: the
  // question a browsing visitor has is "what would my message sound like in
  // this voice", and the real call is one click away on the species page.
  //
  // Only the trained voices get one. The other seven are still the parametric
  // placeholder, and a sample is exactly the thing that would let a visitor
  // mistake the placeholder for the bird — so their cards say "soon" instead
  // and their audio never enters the page payload.
  const samples: Record<string, PlayableAudio> = Object.fromEntries(
    live.map((s) => [s.slug, toPlayable(s.audio.encoded)]),
  )

  const ld = graph([
    breadcrumbLd(
      [
        { name: 'CICI BIRD', path: '/' },
        { name: dict.catalog.title, path: '/species' },
      ],
      locale,
    ),
    {
      '@type': 'CollectionPage',
      '@id': absoluteUrl(localePath(locale, '/species')) + '#page',
      name: dict.catalog.title,
      description: dict.catalog.lede,
      // Only the live species are listed as parts: hasPart is an invitation to
      // crawl, and the "soon" pages are not ones we want a search result
      // sending a visitor to ahead of us.
      hasPart: live.map((s) => ({
        '@type': 'Taxon',
        name: speciesName(s, locale),
        alternateName: s.scientificName,
        url: absoluteUrl(localePath(locale, `/species/${s.slug}`)),
      })),
    },
  ])

  return (
    <PageShell locale={locale} path="/species">
      <JsonLd json={ld} />

      <section className="wrap pb-8 pt-10 sm:pt-12">
        <h1 className="text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[44px]">
          {dict.catalog.title}
        </h1>
        <p className="mt-4 max-w-measure text-[16px] leading-relaxed text-muted">
          {dict.catalog.lede}
        </p>
      </section>

      <SpeciesCatalog
        species={species}
        samples={samples}
        trained={trained}
        locale={locale}
      />

      <section className="border-t border-line bg-white/40 py-14">
        <div className="wrap text-center">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
            {dict.finalCta.title}
          </h2>
          <div className="mt-6 flex justify-center">
            <InstallCTA locale={locale} placement="catalog" />
          </div>
        </div>
      </section>
    </PageShell>
  )
}
