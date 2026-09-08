import type { Metadata } from 'next'
import { MessagePlayer } from '@/views/MessagePlayer'
import { buildMetadata } from '@/lib/seo'
import { lookupMessage } from '@/data/messages'
import { getSpecies, speciesName } from '@/data/species'
import { getDictionary } from '@/i18n/dictionary'

/**
 * The shared message player.
 *
 * `force-dynamic` is deliberate and required. website.md §8 calls for server
 * rendering here so links preview correctly, and unlike the species pages this
 * route CANNOT be prerendered: a share link's state changes after build. A
 * sender revoking a link, or a link ageing past its 30-day window, has to take
 * effect on the next request — a cached "active" render of a revoked message
 * would defeat the revocation the sender just performed.
 *
 * It is also `noindex`. An unguessable, revocable, expiring link that a search
 * engine has published is none of those things, and next-sitemap excludes
 * /m/* for the same reason.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const lookup = lookupMessage(id)
  const dict = getDictionary('tr')

  // The OG description never contains the message text. A link preview is
  // rendered by whatever platform the link was pasted into, and unrolled by
  // servers the sender never chose — so the content stays behind a deliberate
  // press of play, on our page, and the preview carries only the species.
  if (lookup.kind === 'missing') {
    return buildMetadata({
      locale: 'tr',
      path: `/m/${id}`,
      title: dict.message.missingTitle,
      description: dict.message.missingBody,
      noIndex: true,
    })
  }

  const species = getSpecies(lookup.message.speciesSlug)
  const name = species ? speciesName(species, 'tr') : lookup.message.speciesSlug

  if (lookup.kind !== 'found') {
    const expired = lookup.kind === 'expired'
    return buildMetadata({
      locale: 'tr',
      path: `/m/${id}`,
      title: expired ? dict.message.expiredTitle : dict.message.revokedTitle,
      description: expired ? dict.message.expiredBody : dict.message.revokedBody,
      noIndex: true,
    })
  }

  return buildMetadata({
    locale: 'tr',
    path: `/m/${id}`,
    title: `${name} sesiyle bir kuş sesi mesajı`,
    description: `Biri size ${name} sesiyle bir mesaj gönderdi. Çalın ve çözülmüş metni okuyun — uygulama gerekmez.`,
    noIndex: true,
  })
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MessagePlayer lookup={lookupMessage(id)} locale="tr" id={id} />
}
