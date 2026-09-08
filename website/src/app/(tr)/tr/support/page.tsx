import type { Metadata } from 'next'
import { LegalPage } from '@/views/LegalPage'
import { SupportBody, SUPPORT_LAST_UPDATED } from '@/content/legal/support'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'tr',
  path: '/support',
  title: 'Destek',
  description: 'Bir keşfin neden reddedildiği, konumun neden istendiği, bir izni reddederseniz ne olacağı ve satın almaların nasıl geri yükleneceği.',
})

export default function Page() {
  return (
    <LegalPage
      locale="tr"
      path="/support"
      title="Destek"
      lastUpdated={SUPPORT_LAST_UPDATED}
      contactEmail={SITE.contact.support}
    >
      <SupportBody />
    </LegalPage>
  )
}
