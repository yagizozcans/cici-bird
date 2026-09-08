import type { Metadata } from 'next'
import { LegalPage } from '@/views/LegalPage'
import { PrivacyBody, PRIVACY_LAST_UPDATED } from '@/content/legal/privacy'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'tr',
  path: '/privacy',
  title: 'Gizlilik politikası',
  description: 'CICI BIRD mikrofonunuzu, konumunuzu, kayıtlarınızı ve mesajlarınızı nasıl işler — ve bunlar üzerinde kullanabileceğiniz KVKK ve GDPR haklarınız.',
})

export default function Page() {
  return (
    <LegalPage
      locale="tr"
      path="/privacy"
      title="Gizlilik politikası"
      lastUpdated={PRIVACY_LAST_UPDATED}
      contactEmail={SITE.contact.privacy}
    >
      <PrivacyBody />
    </LegalPage>
  )
}
