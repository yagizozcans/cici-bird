import type { Metadata } from 'next'
import { ComingSoon } from '@/views/ComingSoon'

// v1.1 route. Kept out of the index so an empty page never ranks.
export const metadata: Metadata = {
  title: 'Blog',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <ComingSoon
      locale="tr"
      path="/blog"
      title="Blog"
      detail="Tür yazıları ve mevsimlik içerikler v1.1 için planlandı — hakkında yazmaya değer bir katalog oluştuğunda."
    />
  )
}
