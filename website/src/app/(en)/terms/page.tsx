import type { Metadata } from 'next'
import { LegalPage } from '@/views/LegalPage'
import { TermsBody, TERMS_LAST_UPDATED } from '@/content/legal/terms'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'en',
  path: '/terms',
  title: 'Terms of service',
  description: 'The terms for using CICI BIRD, including exactly what a species entitlement is, that it is permanent, and what happens if a species leaves the catalog.',
})

export default function Page() {
  return (
    <LegalPage
      locale="en"
      path="/terms"
      title="Terms of service"
      lastUpdated={TERMS_LAST_UPDATED}
      contactEmail={SITE.contact.legal}
    >
      <TermsBody />
    </LegalPage>
  )
}
