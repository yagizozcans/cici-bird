import type { Metadata } from 'next'
import { ComingSoon } from '@/views/ComingSoon'

// v1.1 route. Kept out of the index so an empty page never ranks.
export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <ComingSoon
      locale="en"
      path="/account"
      title="Account"
      detail="Entitlements, purchase history and device management are planned for v1.1. Digital goods for the app are sold through the App Store and Google Play only — never here."
    />
  )
}
