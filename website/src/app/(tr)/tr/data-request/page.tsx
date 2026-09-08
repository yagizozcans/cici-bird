import type { Metadata } from 'next'
import { LegalPage } from '@/views/LegalPage'
import { DataRequestBody, DATA_REQUEST_LAST_UPDATED } from '@/content/legal/data-request'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'tr',
  path: '/data-request',
  title: 'Veri erişimi ve silme',
  description: 'CICI BIRD’ün hakkınızda ne tuttuğunu sorun ya da silmemizi isteyin. Hiçbir yere gitmeyen bir form değil, 30 günlük süreli gerçek bir yol.',
})

export default function Page() {
  return (
    <LegalPage
      locale="tr"
      path="/data-request"
      title="Veri erişimi ve silme"
      lastUpdated={DATA_REQUEST_LAST_UPDATED}
      contactEmail={SITE.contact.privacy}
    >
      <DataRequestBody />
    </LegalPage>
  )
}
