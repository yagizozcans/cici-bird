import type { Metadata } from 'next'
import { Landing } from '@/views/Landing'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'en',
  path: '/',
  title: SITE.name,
  description:
    'Speak a message and it arrives as birdsong — readable, with the decoded text alongside. The birds you find in the real world become the voices you can speak in.',
})

export default function Page() {
  return <Landing locale="en" />
}
