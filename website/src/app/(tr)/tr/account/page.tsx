import type { Metadata } from 'next'
import { ComingSoon } from '@/views/ComingSoon'

// v1.1 route. Kept out of the index so an empty page never ranks.
export const metadata: Metadata = {
  title: 'Hesap',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <ComingSoon
      locale="tr"
      path="/account"
      title="Hesap"
      detail="Hak sahiplikleri, satın alma geçmişi ve cihaz yönetimi v1.1 için planlandı. Uygulamanın dijital ürünleri yalnızca App Store ve Google Play üzerinden satılır — burada değil."
    />
  )
}
