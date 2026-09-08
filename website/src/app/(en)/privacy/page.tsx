import type { Metadata } from 'next'
import { LegalPage } from '@/views/LegalPage'
import { PrivacyBody, PRIVACY_LAST_UPDATED } from '@/content/legal/privacy'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'en',
  path: '/privacy',
  title: 'Privacy policy',
  description: 'How CICI BIRD handles your microphone, location, recordings and messages — and the KVKK and GDPR rights you can exercise over them.',
})

export default function Page() {
  return (
    <LegalPage
      locale="en"
      path="/privacy"
      title="Privacy policy"
      lastUpdated={PRIVACY_LAST_UPDATED}
      contactEmail={SITE.contact.privacy}
    >
      <PrivacyBody />
    </LegalPage>
  )
}
