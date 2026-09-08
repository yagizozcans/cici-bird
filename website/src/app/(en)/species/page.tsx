import type { Metadata } from 'next'
import { SpeciesCatalogPage } from '@/views/SpeciesCatalogPage'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  locale: 'en',
  path: '/species',
  title: 'Species',
  description:
    'Every voice in CICI BIRD: ten species at launch, where and when each can be found in the wild, and what it costs if you cannot.',
})

export default function Page() {
  return <SpeciesCatalogPage locale="en" />
}
