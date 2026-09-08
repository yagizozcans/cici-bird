import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SpeciesDetail } from '@/views/SpeciesDetail'
import { buildMetadata } from '@/lib/seo'
import {
  getSpecies,
  hasTrainedVoice,
  speciesSlugs,
  speciesName,
} from '@/data/species'
import { getDictionary } from '@/i18n/dictionary'

/**
 * A species page.
 *
 * website.md §5 requires these to be "server-rendered for indexing". They are
 * prerendered at build time from `generateStaticParams` — server-rendered
 * markup that is also a static file, which satisfies the indexing requirement
 * and beats SSR-per-request on the §3 latency budget. The catalog is small
 * and changes with content releases, not per request, so there is nothing to
 * gain from rendering it again for every visitor.
 */

export function generateStaticParams() {
  return speciesSlugs().map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const species = getSpecies(slug)
  if (!species) return {}

  const dict = getDictionary('tr')
  const name = speciesName(species, 'tr')

  return buildMetadata({
    locale: 'tr',
    path: `/species/${slug}`,
    title: name,
    description: `${name} (${species.scientificName}) — CICI BIRD ${dict.species.tierNames[species.tier]} sesi. ${species.habitat.tr} Gerçek ötüşünü ve bu sesle kodlanmış bir mesajı dinleyin.`,
    type: 'article',
    // A species whose voice is not trained yet keeps its page but stays out
    // of the index: nothing on the site links to it, and a search result is
    // just another way to arrive at numbers measured on a placeholder.
    noIndex: !hasTrainedVoice(species),
  })
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const species = getSpecies(slug)
  if (!species) notFound()

  return <SpeciesDetail species={species} locale="tr" />
}
