import type { Metadata } from 'next'
import { LegalPage } from '@/views/LegalPage'
import { TermsBody, TERMS_LAST_UPDATED } from '@/content/legal/terms'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'tr',
  path: '/terms',
  title: 'Kullanım koşulları',
  description: 'CICI BIRD kullanım koşulları: bir tür hakkının tam olarak ne olduğu, kalıcı olduğu ve bir tür katalogdan çıkarsa ne olacağı.',
})

export default function Page() {
  return (
    <LegalPage
      locale="tr"
      path="/terms"
      title="Kullanım koşulları"
      lastUpdated={TERMS_LAST_UPDATED}
      contactEmail={SITE.contact.legal}
    >
      <TermsBody />
    </LegalPage>
  )
}
