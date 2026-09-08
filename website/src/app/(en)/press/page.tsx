import type { Metadata } from 'next'
import { ComingSoon } from '@/views/ComingSoon'

// v1.1 route. Kept out of the index so an empty page never ranks.
export const metadata: Metadata = {
  title: 'Press',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <ComingSoon
      locale="en"
      path="/press"
      title="Press"
      detail="A press kit will follow the launch. Until then, write to the support address in the footer."
    />
  )
}
