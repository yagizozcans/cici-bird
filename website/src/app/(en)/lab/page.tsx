import type { Metadata } from 'next'
import { Lab } from '@/views/Lab'
import { buildMetadata } from '@/lib/seo'
import { getDictionary } from '@/i18n/dictionary'

const dict = getDictionary('en')

export const metadata: Metadata = buildMetadata({
  locale: 'en',
  path: '/lab',
  title: dict.lab.title,
  description: dict.lab.lede,
})

export default function Page() {
  return <Lab locale="en" />
}
