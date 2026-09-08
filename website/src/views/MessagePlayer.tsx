import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { AudioPlayer } from '@/components/AudioPlayer'
import { SpeciesArtwork } from '@/components/SpeciesArtwork'
import { InstallCTA } from '@/components/InstallCTA'
import { getDictionary } from '@/i18n/dictionary'
import { LOCALE_TAG, localePath, type Locale } from '@/i18n/locale'
import { getSpecies, hasTrainedVoice, speciesName } from '@/data/species'
import { toPlayable } from '@/data/audio-manifest'
import type { MessageLookup, SharedMessage } from '@/data/messages'

/**
 * The shared message player, /m/:id (website.md §4).
 *
 * "The highest-leverage page on the site" — it is what a recipient with no app
 * sees when a friend shares a birdsong message, and per §9 it is expected to
 * be the highest-converting path on the site, because the visitor arrived
 * wanting to hear something specific.
 *
 * So the order is: the message first, everything else after. No hero, no
 * marketing above it, no interstitial. The install CTA is framed as "reply in
 * birdsong" and sits below the thing they came for.
 *
 * PRIVACY PROPERTIES ENFORCED HERE (the model is documented in
 * src/data/messages.ts):
 *  - Nothing renders an audio URL unless the lookup returned `found`. Expired
 *    and revoked links reach a state component that is never handed the asset.
 *  - No recipient is displayed, because no recipient field exists on the type.
 *  - The route is noindex, and next-sitemap excludes /m/* — an unguessable,
 *    revocable link that a crawler has published is neither.
 */
export function MessagePlayer({
  lookup,
  locale,
  id,
}: {
  lookup: MessageLookup
  locale: Locale
  id: string
}) {
  const dict = getDictionary(locale)

  if (lookup.kind === 'missing') {
    return (
      <StateShell locale={locale} id={id}>
        <StateCard
          title={dict.message.missingTitle}
          body={dict.message.missingBody}
          locale={locale}
        />
      </StateShell>
    )
  }

  if (lookup.kind === 'expired' || lookup.kind === 'revoked') {
    const expired = lookup.kind === 'expired'
    return (
      <StateShell locale={locale} id={id}>
        <StateCard
          title={expired ? dict.message.expiredTitle : dict.message.revokedTitle}
          body={expired ? dict.message.expiredBody : dict.message.revokedBody}
          locale={locale}
          species={lookup.message.speciesSlug}
        />
      </StateShell>
    )
  }

  return <ActiveMessage message={lookup.message} locale={locale} id={id} />
}

function ActiveMessage({
  message,
  locale,
  id,
}: {
  message: SharedMessage
  locale: Locale
  id: string
}) {
  const dict = getDictionary(locale)
  const species = getSpecies(message.speciesSlug)
  const audio = toPlayable(message.audioId)
  const name = species ? speciesName(species, locale) : message.speciesSlug
  const accent = species?.palette.accent ?? '#B8791B'
  // A species page is only a destination once the voice behind it is trained;
  // until then the badge still identifies the bird, it just does not offer to
  // take the visitor to a page of placeholder measurements.
  const speciesPage = species && hasTrainedVoice(species) ? species : null

  return (
    <PageShell locale={locale} path={`/m/${id}`}>
      <section className="wrap max-w-2xl py-10 sm:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ochre-deep">
          {dict.message.badge}
        </p>

        {/* Species badge, linking to the species page — a §4 requirement, and
            the mechanism by which a shared message becomes a catalog visit. */}
        {species &&
          (() => {
            const badge = (
              <>
                <span className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-line">
                  <SpeciesArtwork species={species} locale={locale} className="h-full w-full" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-[0.1em] text-muted">
                    {dict.message.sentIn}
                  </span>
                  <span className="mt-0.5 block truncate text-[16px] font-semibold tracking-tight text-ink">
                    {name}
                  </span>
                  <span className="block truncate text-[12px] italic text-muted">
                    {species.scientificName}
                  </span>
                </span>
              </>
            )

            return speciesPage ? (
              <Link
                href={localePath(locale, `/species/${speciesPage.slug}`)}
                className="mt-4 flex items-center gap-4 rounded-xl2 border border-line bg-white/60 p-3 transition hover:border-ink/25"
              >
                {badge}
                <span className="ml-auto shrink-0 pr-1 text-[13px] text-muted">→</span>
              </Link>
            ) : (
              <div className="mt-4 flex items-center gap-4 rounded-xl2 border border-line bg-white/60 p-3">
                {badge}
              </div>
            )
          })()}

        {/* The message itself. `feature` renders the synchronized subtitle. */}
        <div className="mt-5 rounded-xl2 border border-line bg-white/70 p-5 shadow-[0_12px_40px_-28px_rgba(22,21,15,0.35)] sm:p-6">
          <AudioPlayer
            audio={audio}
            label={dict.message.playPrompt}
            variant="feature"
            accentColor={accent}
            playLabel={dict.demo.play}
            pauseLabel={dict.demo.pause}
            subtitleHint={dict.message.subtitleHint}
            analyticsEvent="message_play"
            analyticsProps={{ species: message.speciesSlug }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted">
          <span>
            {dict.message.sharedOn}: <Stamp iso={message.sharedAt} locale={locale} />
          </span>
          <span>
            {dict.message.expiresIn}:{' '}
            <Stamp iso={message.expiresAt} locale={locale} />
          </span>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          {dict.message.privacyNote}
        </p>

        {/* "Reply in birdsong" — the §4 CTA framing. */}
        <div className="mt-10 rounded-xl2 border border-line bg-white/50 p-6">
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">
            {dict.message.replyTitle}
          </h2>
          <p className="mt-2 max-w-measure text-[14px] leading-relaxed text-muted">
            {dict.message.replyBody}
          </p>
          <InstallCTA locale={locale} placement="message" className="mt-6" />
        </div>

        <DemoNotice text={dict.message.demoNotice} />
      </section>
    </PageShell>
  )
}

function StateShell({
  locale,
  id,
  children,
}: {
  locale: Locale
  id: string
  children: React.ReactNode
}) {
  const dict = getDictionary(locale)
  return (
    <PageShell locale={locale} path={`/m/${id}`}>
      <section className="wrap max-w-2xl py-14 sm:py-20">
        {children}
        <DemoNotice text={dict.message.demoNotice} />
      </section>
    </PageShell>
  )
}

/**
 * The expired / revoked / missing states.
 *
 * Note what this component is NOT given: the message's audio id, its text, or
 * anything else about its content. A link that has been turned off must reveal
 * nothing, and the cheapest way to guarantee that is to make the leak
 * impossible at the prop level rather than remembering not to render it.
 *
 * The species slug IS passed for expired and revoked links, because the sender
 * chose to reveal the species when they shared it and it gives the visitor
 * somewhere to go. It is omitted for a link that never existed.
 */
function StateCard({
  title,
  body,
  locale,
  species: speciesSlug,
}: {
  title: string
  body: string
  locale: Locale
  species?: string
}) {
  const dict = getDictionary(locale)
  const found = speciesSlug ? getSpecies(speciesSlug) : null
  // Same rule as the active badge: offer the species page only when there is a
  // trained voice behind it. The catalog link below is always safe, because
  // the catalog is where the "soon" state is explained.
  const species = found && hasTrainedVoice(found) ? found : null

  return (
    <div className="rounded-xl2 border border-line bg-white/60 p-6 sm:p-8">
      <h1 className="text-balance text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
        {title}
      </h1>
      <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
        {body}
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        {species && (
          <Link
            href={localePath(locale, `/species/${species.slug}`)}
            className="rounded-full border border-ink/20 px-5 py-2.5 text-[13px] font-medium text-ink transition hover:border-ink/50"
          >
            {dict.message.aboutSpecies}: {speciesName(species, locale)}
          </Link>
        )}
        <Link
          href={localePath(locale, '/species')}
          className="rounded-full border border-ink/20 px-5 py-2.5 text-[13px] font-medium text-ink transition hover:border-ink/50"
        >
          {dict.catalog.title}
        </Link>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          {dict.message.replyTitle}
        </h2>
        <InstallCTA locale={locale} placement="message-state" className="mt-4" />
      </div>
    </div>
  )
}

/**
 * Absolute date, formatted for the locale.
 *
 * Rendered server-side with an explicit UTC timezone so the server and client
 * markup agree — a locale-formatted date that reads the visitor's timezone
 * hydrates to different text than it rendered with, which React reports as a
 * mismatch and which makes a shared link look broken for one frame.
 */
function Stamp({ iso, locale }: { iso: string; locale: Locale }) {
  const formatted = new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
  return <time dateTime={iso}>{formatted}</time>
}

function DemoNotice({ text }: { text: string }) {
  return (
    <p className="mt-10 rounded-lg border border-dashed border-line px-4 py-3 text-[12px] leading-relaxed text-muted">
      {text}
    </p>
  )
}
