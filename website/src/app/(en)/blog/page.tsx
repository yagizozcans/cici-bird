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
      locale="en"
      path="/blog"
      title="Blog"
      detail="Species features and seasonal writing are planned for v1.1, once there is a catalog worth writing about."
    />
  )
}
