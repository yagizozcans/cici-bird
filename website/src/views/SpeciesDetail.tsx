import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { SpeciesArtwork } from '@/components/SpeciesArtwork'
import { AudioPlayer } from '@/components/AudioPlayer'
import { AssetCredit } from '@/components/AssetCredit'
import { InstallCTA } from '@/components/InstallCTA'
import { JsonLd } from '@/components/JsonLd'
import { getDictionary } from '@/i18n/dictionary'
import { localePath, type Locale } from '@/i18n/locale'
import {
  speciesAssets,
  speciesCall,
  speciesEncoded,
  speciesName,
  type Species,
} from '@/data/species'
import { getTrainedVoice, toPlayable } from '@/data/audio-manifest'
import { TrainedVoicePanel } from '@/components/TrainedVoicePanel'
import {
  LiveVoiceMark,
  LiveVoiceMessage,
  LiveVoiceProvider,
} from '@/components/LiveVoice'
import { voiceSpace } from '@/data/lab'
import { layoutVoiceScore } from '@/lib/voice-score'
import { breadcrumbLd, graph, speciesLd } from '@/lib/jsonld'

/**
 * A species page (website.md §5).
 *
 * Required content, all present below: artwork, common and scientific name,
 * a sample of the real call AND a sample of an encoded message in that voice,
 * where and when it can be found, tier and unlock paths, and attribution
 * rendered from asset metadata.
 *
 * These pages are the SEO asset — species names are high-intent, low-
 * competition search terms — so they are server-rendered with structured data
 * and both localized common names, which is what lets "bülbül" and
 * "nightingale" resolve to the same page in their respective languages.
 */
export function SpeciesDetail({
  species,
  locale,
}: {
  species: Species
  locale: Locale
}) {
  const dict = getDictionary(locale)
  const name = speciesName(species, locale)
  const call = speciesCall(species)
  const encoded = speciesEncoded(species)
  const assets = speciesAssets(species)
  const findable = species.unlock.findable
  // Non-null only for a species with a trained model behind its voice.
  const trainedVoice = getTrainedVoice(species.slug)
  const message = toPlayable(encoded.id)
  // The mark for a trained voice is the message itself, drawn from the cues
  // and contours that voice actually produced. A parametric voice has no such
  // measurement, so those seven species keep the synthesized signature.
  const score = trainedVoice
    ? layoutVoiceScore(voiceSpace(species.slug), message.cues, message.durationSec)
    : null

  const ld = graph([
    breadcrumbLd(
      [
        { name: 'CICI BIRD', path: '/' },
        { name: dict.catalog.title, path: '/species' },
        { name, path: `/species/${species.slug}` },
      ],
      locale,
    ),
    speciesLd(species, assets, locale),
  ])

  return (
    <PageShell locale={locale} path={`/species/${species.slug}`}>
      <JsonLd json={ld} />

      <div className="wrap pt-6">
        <Link
          href={localePath(locale, '/species')}
          className="text-[13px] text-muted underline-offset-2 transition hover:text-ink hover:underline"
        >
          ← {dict.species.backToCatalog}
        </Link>
      </div>

      {/* The mark and the message player share one playhead, so the mark can
          light the note being sung. The provider renders no element of its
          own — see components/LiveVoice.tsx. */}
      <LiveVoiceProvider audio={message} speciesSlug={species.slug}>

      {/* ------------------------------------------------------------------ */}
      {/* Identity                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="wrap grid gap-8 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={species.palette.accent}>
              {dict.species.tierNames[species.tier]}
            </Badge>
            <Badge color={findable ? '#3F5940' : '#6B675C'} subtle>
              {findable ? dict.catalog.findable : dict.catalog.purchaseOnly}
            </Badge>
          </div>

          <h1 className="mt-4 text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[46px]">
            {name}
          </h1>
          <p className="mt-2 text-[16px] italic text-muted">
            {species.scientificName}
          </p>

          {/* Both common names, always. The other language's name is content,
              not a UI string — it is exactly the "localized common names,
              which is real content work" §8 calls out. */}
          <p className="mt-3 text-[13px] text-muted">
            {locale === 'tr' ? dict.species.alsoKnownEn : dict.species.alsoKnown}:{' '}
            <span className="text-ink/80">
              {locale === 'tr' ? species.names.en : species.names.tr}
            </span>
          </p>

          <p className="mt-6 max-w-measure text-pretty text-[16px] leading-relaxed text-ink/85">
            {species.blurb[locale] || species.blurb.en}
          </p>
        </div>

        {score ? (
          <LiveVoiceMark
            score={score}
            palette={species.palette}
            label={dict.species.score.stageLabel.replace('{species}', name)}
            caption={dict.species.score.caption}
          />
        ) : (
          <div className="overflow-hidden rounded-xl2 border border-line">
            <SpeciesArtwork
              species={species}
              locale={locale}
              variant="hero"
              className="h-full w-full"
            />
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Audio: the real call, and a message encoded in that voice           */}
      {/* ------------------------------------------------------------------ */}
      <section className="wrap grid gap-5 pb-4 sm:grid-cols-2">
        <div className="rounded-xl2 border border-line bg-white/60 p-5">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {dict.species.realCall}
          </h2>
          <AudioPlayer
            audio={toPlayable(call.id)}
            label={name}
            variant="bar"
            accentColor={species.palette.base}
            playLabel={dict.demo.play}
            pauseLabel={dict.demo.pause}
            caption={
              call.credit.kind === 'synth-reference'
                ? call.credit.note
                : undefined
            }
            analyticsEvent="sample_play"
            analyticsProps={{ species: species.slug, surface: 'species-call' }}
          />
        </div>

        <div className="rounded-xl2 border border-line bg-white/60 p-5">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {dict.species.encodedSample}
          </h2>
          <LiveVoiceMessage
            audio={message}
            label={encoded.text ?? name}
            variant="feature"
            accentColor={species.palette.accent}
            playLabel={dict.demo.play}
            pauseLabel={dict.demo.pause}
            subtitleHint={dict.species.encodedSampleNote}
          />
        </div>
      </section>

      </LiveVoiceProvider>

      {trainedVoice && (
        <TrainedVoicePanel
          voice={trainedVoice}
          encoded={encoded}
          locale={locale}
          accent={species.palette.accent}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Where and when, tier and unlock, voice character                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="wrap grid gap-8 py-10 lg:grid-cols-3">
        <Panel title={dict.species.whereWhen}>
          <dl className="space-y-3 text-[13.5px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                {dict.species.regions}
              </dt>
              <dd className="mt-1 text-ink/85">
                {species.regions.map((r) => dict.regions[r]).join(' · ')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                {dict.species.seasons}
              </dt>
              <dd className="mt-1 text-ink/85">
                {species.seasons.length === 4
                  ? dict.seasons.yearRound
                  : species.seasons.map((s) => dict.seasons[s]).join(' · ')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                {dict.species.habitat}
              </dt>
              <dd className="mt-1 text-ink/85">
                {species.habitat[locale] || species.habitat.en}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title={dict.species.unlockTitle}>
          <p className="text-[13.5px] leading-relaxed text-ink/85">
            <span className="font-medium text-ink">
              {dict.species.tierNames[species.tier]}
            </span>{' '}
            — {dict.species.unlockPaths[species.unlock.path]}
          </p>
          {species.unlock.discountPct !== null &&
            species.unlock.discountPct < 100 && (
              <p className="mt-3 text-[13px] text-muted">
                {species.unlock.discountPct}% off for a verified field discovery.
              </p>
            )}
          {/* When a species cannot be found, the page says why rather than
              leaving the visitor to hunt for something unobtainable. */}
          {!findable && species.findableNote && (
            <p className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] leading-relaxed text-muted">
              {species.findableNote[locale] || species.findableNote.en}
            </p>
          )}
        </Panel>

        <Panel title={dict.species.voiceTitle}>
          <p className="text-[13.5px] leading-relaxed text-ink/85">
            {species.voiceNote[locale] || species.voiceNote.en}
          </p>
        </Panel>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Credits — rendered from metadata, never hand-maintained             */}
      {/* ------------------------------------------------------------------ */}
      <section className="wrap pb-14">
        <div className="rounded-xl2 border border-line bg-white/60 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[14px] font-semibold tracking-tight text-ink">
              {dict.species.creditsTitle}
            </h2>
            <p className="text-[11px] text-muted">{dict.species.creditsNote}</p>
          </div>
          {assets.map((asset) => (
            <AssetCredit key={asset.id} asset={asset} locale={locale} />
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-white/40 py-14">
        <div className="wrap text-center">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
            {dict.finalCta.title}
          </h2>
          <div className="mt-6 flex justify-center">
            <InstallCTA locale={locale} placement="species" />
          </div>
        </div>
      </section>
    </PageShell>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl2 border border-line bg-white/60 p-5">
      <h2 className="mb-3 text-[14px] font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Badge({
  children,
  color,
  subtle = false,
}: {
  children: React.ReactNode
  color: string
  subtle?: boolean
}) {
  return (
    // Dark ink on a tint of the accent rather than paper-on-accent. At 10px
    // the text needs 4.5:1, and several species accents are too light to carry
    // white type — the tint keeps each species' colour while the label stays
    // legible for all of them.
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink"
      style={
        subtle
          ? { boxShadow: `inset 0 0 0 1px ${color}55` }
          : { backgroundColor: `${color}2E`, boxShadow: `inset 0 0 0 1px ${color}70` }
      }
    >
      {children}
    </span>
  )
}
