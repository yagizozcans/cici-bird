import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { JsonLd } from '@/components/JsonLd'
import { VoiceSpace } from '@/components/lab/VoiceSpace'
import { getDictionary } from '@/i18n/dictionary'
import { LOCALE_TAG, localePath, type Locale } from '@/i18n/locale'
import { voiceSpace, type LabEntry as Entry } from '@/data/lab'
import { getSpecies, hasTrainedVoice, speciesName } from '@/data/species'
import { getTrainedVoice, toPlayable } from '@/data/audio-manifest'
import { breadcrumbLd, graph } from '@/lib/jsonld'

/**
 * One Lab entry.
 *
 * The frame — breadcrumb, title, species, date — is shared, and the body is
 * chosen by the entry's KIND rather than its slug: every entry so far is a
 * voice space, one per bird, and they differ only in which numbers they read.
 * An experiment that needs a different body adds a kind here, not a branch
 * per bird.
 *
 * The body's prose comes from the dictionary and its numbers from the
 * generated data file, so the write-up can never quote a figure the data no
 * longer supports: regenerate the data and the page follows. That is also why
 * no sentence in `dict.lab.voiceSpace` names a species — the ones that need
 * to say which bird take `{species}` and are filled in below.
 */
export function LabEntry({ entry, locale }: { entry: Entry; locale: Locale }) {
  const dict = getDictionary(locale)
  const copy = dict.lab.entries[entry.slug]
  const species = getSpecies(entry.speciesSlug)
  const name = species ? speciesName(species, locale) : entry.speciesSlug
  const date = new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(entry.date))

  const ld = graph([
    breadcrumbLd(
      [
        { name: 'CICI BIRD', path: '/' },
        { name: dict.lab.title, path: '/lab' },
        { name: copy.title, path: `/lab/${entry.slug}` },
      ],
      locale,
    ),
  ])

  return (
    <PageShell locale={locale} path={`/lab/${entry.slug}`}>
      <JsonLd json={ld} />

      <div className="wrap pt-6">
        <Link
          href={localePath(locale, '/lab')}
          className="text-[13px] text-muted underline-offset-2 transition hover:text-ink hover:underline"
        >
          ← {dict.lab.backToLab}
        </Link>
      </div>

      <section className="wrap pb-4 pt-8 sm:pt-10">
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ochre-deep">
          <span>{dict.lab.eyebrow}</span>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          {/* Linked only when the species page is live — a lab note about a
              trained voice may still name a bird whose page is "soon". */}
          {species && hasTrainedVoice(species) ? (
            <Link
              href={localePath(locale, `/species/${species.slug}`)}
              className="text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="text-muted">{name}</span>
          )}
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <time dateTime={entry.date} className="font-normal normal-case tracking-normal text-muted">
            {date}
          </time>
        </p>
        <h1 className="mt-3 text-balance text-[32px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">
          {copy.title}
        </h1>
      </section>

      {entry.kind === 'voice-space' && (
        <VoiceSpaceEntry entry={entry} locale={locale} name={name} />
      )}
    </PageShell>
  )
}

/* ------------------------------------------------------------------------ */
/* kind: voice-space                                                         */
/* ------------------------------------------------------------------------ */

function VoiceSpaceEntry({
  entry,
  locale,
  name,
}: {
  entry: Entry
  locale: Locale
  name: string
}) {
  const dict = getDictionary(locale)
  const copy = dict.lab.voiceSpace
  // Runs the checkpoint guard: throws at prerender if the data was measured
  // against a different model than the audio it is about to sync with.
  const data = voiceSpace(entry.speciesSlug)
  const { meta } = data
  const voice = getTrainedVoice(entry.speciesSlug)
  const species = getSpecies(entry.speciesSlug)
  if (!voice || !species) {
    throw new Error(`${entry.slug}: no trained voice or species for "${entry.speciesSlug}"`)
  }
  const messages = entry.audioIds.map(toPlayable)
  const measured = new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(meta.generatedAt))

  const pairs: { key: keyof typeof meta.correlations; demoted?: boolean }[] = [
    { key: 'pitchBright', demoted: true },
    { key: 'pitchDur' },
    { key: 'pitchSlope' },
    { key: 'durSlope' },
  ]

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* 1. THE SPACE, LIVE                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="wrap pb-16">
        <p className="max-w-measure text-pretty text-[16px] leading-relaxed text-ink/85">
          {copy.lede}
        </p>
        <div className="mt-8">
          <VoiceSpace
            data={data}
            copy={copy}
            stageLabel={copy.stageLabel.replace('{species}', name)}
            messages={messages}
            palette={species.palette}
            playLabel={dict.demo.play}
            pauseLabel={dict.demo.pause}
            subtitleHint={dict.species.encodedSampleNote}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. WHY THESE THREE AXES                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-line bg-white/40 py-16">
        <div className="wrap grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <SectionHeading title={copy.method.title} />
            <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
              {copy.method.body}
            </p>
          </div>
          <table className="self-start border-collapse text-[14px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                <th scope="col" className="pb-2 pr-6 text-left font-semibold">
                  {copy.method.pairHeading}
                </th>
                <th scope="col" className="pb-2 text-right font-semibold">
                  {copy.method.rHeading}
                </th>
              </tr>
            </thead>
            <tbody>
              {pairs.map(({ key, demoted }) => (
                <tr key={key} className="border-t border-line">
                  <td className="py-2 pr-6 text-ink/85">
                    {copy.method.pairs[key]}
                    {demoted && (
                      <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                        {copy.method.demoted}
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2 text-right font-mono tabular-nums ${
                      demoted ? 'text-muted' : 'text-ink'
                    }`}
                  >
                    {meta.correlations[key].toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 3. WHERE THE POINTS COME FROM                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="wrap py-16">
        <SectionHeading title={copy.provenance.title} />
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={copy.provenance.checkpoint}>
            <span className="font-mono text-[12px]">{voice.model}</span>
          </Field>
          <Field label={copy.provenance.recordings}>
            <span className="font-mono tabular-nums">{voice.corpusSize}</span>{' '}
            {copy.provenance.clips}
          </Field>
          <Field label={copy.provenance.notes}>
            <span className="font-mono tabular-nums">{meta.libNotes}</span>
          </Field>
          <Field label={copy.provenance.generated}>{measured}</Field>
        </dl>
        <dl className="mt-6">
          <Field label={copy.provenance.assignment}>
            <span className="block max-w-measure">{copy.provenance.assignmentBody}</span>
          </Field>
        </dl>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. READING THE PLOT                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-line bg-white/40 py-16">
        <div className="wrap">
          <SectionHeading title={copy.reading.title} />
          <div className="mt-4 max-w-measure space-y-4 text-[15px] leading-relaxed text-muted">
            <p>
              {copy.reading.spine}{' '}
              <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[13px] text-ink">
                {meta.base} + i × {meta.step} Hz
              </code>{' '}
              {copy.reading.spineAfter}
            </p>
            <p>{copy.reading.scatter.replace('{species}', name)}</p>
          </div>
        </div>
      </section>
    </>
  )
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-balance text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
      {title}
    </h2>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] leading-relaxed text-ink/85">{children}</dd>
    </div>
  )
}
