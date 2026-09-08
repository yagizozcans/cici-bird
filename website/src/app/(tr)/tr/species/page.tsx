import type { Metadata } from 'next'
import { SpeciesCatalogPage } from '@/views/SpeciesCatalogPage'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  locale: 'tr',
  path: '/species',
  title: 'Türler',
  description:
    'CICI BIRD’deki her ses: lansmanda on tür, her birinin doğada nerede ve ne zaman bulunabileceği ve bulamazsanız neye mal olacağı.',
})

export default function Page() {
  return <SpeciesCatalogPage locale="tr" />
}
