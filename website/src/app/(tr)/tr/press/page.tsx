import type { Metadata } from 'next'
import { ComingSoon } from '@/views/ComingSoon'

// v1.1 route. Kept out of the index so an empty page never ranks.
export const metadata: Metadata = {
  title: 'Basın',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <ComingSoon
      locale="tr"
      path="/press"
      title="Basın"
      detail="Basın kiti lansmandan sonra yayımlanacak. O zamana kadar alt bilgideki destek adresine yazın."
    />
  )
}
