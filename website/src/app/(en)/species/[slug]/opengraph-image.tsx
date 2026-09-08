import { speciesOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og'
import { getSpecies, speciesSlugs, speciesName } from '@/data/species'
import { getDictionary } from '@/i18n/dictionary'
import { notFound } from 'next/navigation'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'CICI BIRD species'

export function generateStaticParams() {
  return speciesSlugs().map((slug) => ({ slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const species = getSpecies(slug)
  if (!species) notFound()

  const dict = getDictionary('en')
  return speciesOgImage({
    species,
    name: speciesName(species, 'en'),
    eyebrow: `${dict.species.tierNames[species.tier]} voice`,
    headline: species.scientificName,
    footnote: species.unlock.findable
      ? dict.catalog.findable
      : dict.catalog.purchaseOnly,
  })
}
