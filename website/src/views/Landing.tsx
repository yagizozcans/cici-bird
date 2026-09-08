import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { HeroDemo, type DemoVoice } from '@/components/HeroDemo'
import { InstallCTA } from '@/components/InstallCTA'
import { SpeciesArtwork } from '@/components/SpeciesArtwork'
import { getDictionary } from '@/i18n/dictionary'
import { localePath, type Locale } from '@/i18n/locale'
import {
  allSpecies,
  hasTrainedVoice,
  speciesName,
  type Species,
} from '@/data/species'
import {
  getAsset,
  getAssetOrNull,
  toPlayable,
  type AudioAsset,
} from '@/data/audio-manifest'

/**
 * The landing page (website.md §3).
 *
 * Section order is fixed by the spec and is not a layout preference:
 *   above the fold — one-liner, interactive demo, install CTAs
 *   1. how it works      2. collect the voices (the differentiator, most
 *   space)               3. species preview      4. credibility
 *   5. install CTA, repeated
 *
 * Everything here renders on the server. The only client JavaScript on this
 * route is the demo player, the consent banner and the CTA click handlers —
 * which is how the §3 budget of LCP under 2.5s is met on a phone: the largest
 * element is text, and no audio byte is fetched until someone presses play.
 */

// Every demo voice is backed by a TRAINED DDSP MODEL. The catalog still
// carries the parametric species, but the landing demo is where a visitor
// decides what this product sounds like, and a hand-authored profile puts one
// pure tone per letter on a fixed grid. website.md §3 asks for "two or three
// different bird voices" — trained ones satisfy it honestly.
//
// WHICH voices is NOT decided here. It used to be a hardcoded slug list that
// had to be kept in step by hand with DEMO_VOICES in
// website/scripts/generate_audio.py, which is the list that actually decides
// which demo clips get built. Adding the cardinal to the generator alone
// produced a built asset the site never played, silently — so the page now
// asks the manifest what demo clips exist and renders them in catalog order.
// A fourth trained voice is then a generator change and nothing else.
const PREVIEW_COUNT = 6

export function Landing({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const human = getAsset('demo-human')

  const voices: DemoVoice[] = allSpecies()
    .map((species) => ({ species, asset: getAssetOrNull(`demo-${species.slug}`) }))
    .filter(
      (pair): pair is { species: Species; asset: AudioAsset } =>
        pair.asset !== null,
    )
    .map(({ species, asset }) => ({
      slug: species.slug,
      name: speciesName(species, locale),
      tier: species.tier,
      accent: species.palette.accent,
      audio: toPlayable(asset.id),
      decodeAccuracy: asset.decodeAccuracy ?? 1,
      neural: asset.synthesis?.method === 'neural-ddsp',
    }))

  const preview = allSpecies().slice(0, PREVIEW_COUNT)

  return (
    <PageShell locale={locale} path="/">
      {/* ---------------------------------------------------------------- */}
      {/* ABOVE THE FOLD                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="wrap pb-12 pt-10 sm:pt-14">
        {/*
          ORDERING IS A SPEC REQUIREMENT, AND IT DIFFERS BY BREAKPOINT.

          §3 puts the one-liner, then the demo, then the install buttons above
          the fold — and says the page is mobile-first, because most traffic
          arrives on a phone from a shared link. A plain two-column grid stacks
          into heading, CTA, demo on a phone, which asks for the install before
          the visitor has heard anything. So the demo is explicitly ordered
          second on small screens, and explicit grid placement restores the
          two-column reading on large ones.
        */}
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8">
          <div className="order-1 lg:col-start-1 lg:row-start-1 lg:pt-6">
            <h1 className="text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[52px]">
              {dict.hero.oneLiner}
            </h1>
            <p className="mt-5 max-w-[42ch] text-pretty text-[16px] leading-relaxed text-muted sm:text-[17px]">
              {dict.hero.sub}
            </p>
          </div>

          <div className="order-3 lg:col-start-1 lg:row-start-2">
            <InstallCTA locale={locale} size="large" placement="hero" />
          </div>

          <div className="order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
                {dict.hero.demoTitle}
              </h2>
              <p className="text-[12px] text-muted">{dict.hero.demoHint}</p>
            </div>
            <HeroDemo
              locale={locale}
              human={toPlayable('demo-human')}
              humanText={human.text ?? ''}
              voices={voices}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 1. HOW IT WORKS                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="border-t border-line bg-white/40 py-16">
        <div className="wrap">
          <SectionHeading title={dict.how.title} lede={dict.how.lede} />

          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {dict.how.steps.map((step, index) => (
              <li key={step.title}>
                <span className="inline-grid h-8 w-8 place-items-center rounded-full border border-ink/15 font-mono text-[13px] text-ink">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. COLLECT THE VOICES — the differentiator, and the longest       */}
      {/*    section on the page by requirement, not by accident.           */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-20">
        <div className="wrap">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ochre-deep">
                {dict.collect.eyebrow}
              </p>
              <h2 className="mt-3 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[38px]">
                {dict.collect.title}
              </h2>
              <p className="mt-5 text-pretty text-[17px] leading-relaxed text-ink/80">
                {dict.collect.lede}
              </p>
              <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
                {dict.collect.body}
              </p>
            </div>

            <dl className="grid gap-6 sm:grid-cols-2 lg:gap-7">
              {dict.collect.points.map((point) => (
                <div key={point.title}>
                  <dt className="text-[14px] font-semibold tracking-tight text-ink">
                    {point.title}
                  </dt>
                  <dd className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                    {point.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* What a find is worth — the tier economics, stated plainly rather
              than discovered at a paywall. */}
          <div className="mt-14 rounded-xl2 border border-line bg-white/60 p-6 sm:p-8">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">
              {dict.collect.tiersTitle}
            </h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <TierNote
                label={dict.species.tierNames.starter}
                body={dict.collect.tiers.starter}
                color="#5C594F"
              />
              <TierNote
                label={dict.species.tierNames.basic}
                body={dict.collect.tiers.basic}
                color="#35492F"
              />
              <TierNote
                label={dict.species.tierNames.premium}
                body={dict.collect.tiers.premium}
                color="#8E5C10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 3. SPECIES PREVIEW                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-line bg-white/40 py-16">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading title={dict.preview.title} lede={dict.preview.lede} />
            <Link
              href={localePath(locale, '/species')}
              className="shrink-0 rounded-full border border-ink/20 px-5 py-2.5 text-[13px] font-medium text-ink transition hover:border-ink/50"
            >
              {dict.preview.cta} →
            </Link>
          </div>

          {/* A preview, not the catalog: artwork and name only, no players.
              Eleven audio elements above the fold of section three would
              undo the lazy-loading discipline the demo depends on.

              A species whose voice is not trained yet is shown but not
              linked — same rule as the catalog card. The tile is the promise;
              the page behind it would be a placeholder wearing the bird's
              name. */}
          <ul className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {preview.map((species) => {
              const ready = hasTrainedVoice(species)
              const body = (
                <>
                  <div className="aspect-[3/2] overflow-hidden border-b border-line">
                    <SpeciesArtwork
                      species={species}
                      locale={locale}
                      className={`h-full w-full ${
                        ready ? '' : 'opacity-45 saturate-[0.35]'
                      }`}
                    />
                  </div>
                  <div className="p-3">
                    <p
                      className={`truncate text-[13px] font-medium ${
                        ready ? 'text-ink' : 'text-ink/60'
                      }`}
                    >
                      {speciesName(species, locale)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {ready
                        ? dict.species.tierNames[species.tier]
                        : dict.catalog.soon}
                    </p>
                  </div>
                </>
              )

              return (
                <li key={species.slug}>
                  {ready ? (
                    <Link
                      href={localePath(locale, `/species/${species.slug}`)}
                      className="group block overflow-hidden rounded-xl2 border border-line bg-white/70 transition hover:border-ink/25"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="block overflow-hidden rounded-xl2 border border-line bg-white/40">
                      {body}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. CREDIBILITY                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16">
        <div className="wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <SectionHeading title={dict.credibility.title} />
            <p className="mt-5 max-w-measure text-[15px] leading-relaxed text-muted">
              {dict.credibility.body}
            </p>
            <p className="mt-4 max-w-measure text-[13px] leading-relaxed text-muted">
              {dict.credibility.modelNote}
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl2 border border-line bg-white/60 p-5">
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">
                {dict.credibility.honestTitle}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                {dict.credibility.honest}
              </p>
            </div>
            <div className="rounded-xl2 border border-line bg-white/60 p-5">
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">
                {dict.credibility.attributionTitle}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                {dict.credibility.attributionNote}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 5. INSTALL CTA, REPEATED                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-line bg-white/40 py-20">
        <div className="wrap text-center">
          <h2 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[38px]">
            {dict.finalCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[36ch] text-[16px] text-muted">
            {dict.finalCta.body}
          </p>
          <div className="mt-8 flex justify-center">
            <InstallCTA locale={locale} size="large" placement="footer" />
          </div>
        </div>
      </section>
    </PageShell>
  )
}

function SectionHeading({ title, lede }: { title: string; lede?: string }) {
  return (
    <div>
      <h2 className="text-balance text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
        {title}
      </h2>
      {lede && (
        <p className="mt-3 max-w-measure text-[15px] leading-relaxed text-muted">
          {lede}
        </p>
      )}
    </div>
  )
}

function TierNote({
  label,
  body,
  color,
}: {
  label: string
  body: string
  color: string
}) {
  return (
    <div className="border-l-2 pl-4" style={{ borderColor: color }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
        {label}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
    </div>
  )
}
