import type { Metadata } from 'next'
import { Landing } from '@/views/Landing'
import { buildMetadata } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  locale: 'tr',
  path: '/',
  title: SITE.name,
  description:
    'Bir mesaj söyleyin, kuş sesi olarak ulaşsın — çözülmüş metniyle birlikte, okunabilir. Gerçek dünyada bulduğunuz kuşlar, konuşabileceğiniz sesler olur.',
})

export default function Page() {
  return <Landing locale="tr" />
}
