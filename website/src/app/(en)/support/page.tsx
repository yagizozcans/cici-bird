import type { Metadata } from 'next'
import { LegalPage } from '@/views/LegalPage'
import { SupportBody, SUPPORT_LAST_UPDATED } from '@/content/legal/support'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'en',
  path: '/support',
  title: 'Support',
  description: 'Why a discovery was rejected, why location is requested, what happens if you deny a permission, and how to restore purchases.',
})

export default function Page() {
  return (
    <LegalPage
      locale="en"
      path="/support"
      title="Support"
      lastUpdated={SUPPORT_LAST_UPDATED}
      contactEmail={SITE.contact.support}
    >
      <SupportBody />
    </LegalPage>
  )
}
