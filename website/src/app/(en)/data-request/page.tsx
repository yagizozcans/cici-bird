import type { Metadata } from 'next'
import { LegalPage } from '@/views/LegalPage'
import { DataRequestBody, DATA_REQUEST_LAST_UPDATED } from '@/content/legal/data-request'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'en',
  path: '/data-request',
  title: 'Data access and deletion',
  description: 'Ask what CICI BIRD holds about you, or ask us to delete it. A real route with a 30-day deadline, not a form that goes nowhere.',
})

export default function Page() {
  return (
    <LegalPage
      locale="en"
      path="/data-request"
      title="Data access and deletion"
      lastUpdated={DATA_REQUEST_LAST_UPDATED}
      contactEmail={SITE.contact.privacy}
    >
      <DataRequestBody />
    </LegalPage>
  )
}
