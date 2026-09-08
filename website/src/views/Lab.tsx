import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { JsonLd } from '@/components/JsonLd'
import { getDictionary } from '@/i18n/dictionary'
import { LOCALE_TAG, localePath, type Locale } from '@/i18n/locale'
import { LAB_ENTRIES, WILD_VOICES_ANCHOR, wildVoices, type LabEntry } from '@/data/lab'
import { getSpecies, speciesName } from '@/data/species'
import { breadcrumbLd, graph } from '@/lib/jsonld'

/**
 * The Lab index.
 *
 * One card per experiment. The card carries only what the registry knows —
 * species, date — plus the entry's title and summary from the dictionary. It
 * does not preview the data: an entry's plot is heavy enough that it should
 * load on its own page, and a card that shows a static thumbnail of an
 * interactive thing sets up the wrong expectation.
 */
export function Lab({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const ld = graph([
    breadcrumbLd(
      [
        { name: 'CICI BIRD', path: '/' },
        { name: dict.lab.title, path: '/lab' },
      ],
      locale,
    ),
  ])

  return (
    <PageShell locale={locale} path="/lab">
      <JsonLd json={ld} />

      <section className="wrap pb-6 pt-10 sm:pt-14">
        <h1 className="text-balance text-[32px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">
          {dict.lab.title}
        </h1>
        <p className="mt-3 max-w-measure text-pretty text-[16px] leading-relaxed text-muted">
          {dict.lab.lede}
        </p>
      </section>

      <section className="wrap pb-20">
        <ul className="grid gap-4 sm:grid-cols-2">
          {LAB_ENTRIES.map((entry) => (
            <EntryCard key={entry.slug} entry={entry} locale={locale} />
          ))}
        </ul>
      </section>
    </PageShell>
  )
}

function EntryCard({ entry, locale }: { entry: LabEntry; locale: Locale }) {
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
  // How many field recordings the entry actually carries, from the generated
  // file rather than a number typed into copy.
  const clips = wildVoices(entry.speciesSlug).meta.nClips

  return (
    <li className="relative rounded-xl2 border border-line bg-white/60 p-5 transition hover:border-ink/30 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {species && (
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: species.palette.accent }}
          />
        )}
        <span>{name}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={entry.date} className="font-normal normal-case tracking-normal">
          {date}
        </time>
      </div>
      <h2 className="mt-3 text-[20px] font-semibold leading-snug tracking-tight text-ink">
        <Link
          href={localePath(locale, `/lab/${entry.slug}`)}
          className="after:absolute after:inset-0 after:rounded-xl2"
        >
          {copy.title}
        </Link>
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{copy.summary}</p>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[13px] font-medium">
        <span className="text-ochre-deep">{dict.lab.open} →</span>
        {/* The entry's second half is a different thing from its plot — real
            recordings of the bird, read by our decoder — and a visitor who
            wanted THAT would never guess it lives at the bottom of a page
            called "voice space". So it gets its own way in, deep-linked to
            the section. `relative z-10` lifts it above the card's stretched
            title link, which otherwise covers every pixel of the card. */}
        <Link
          href={localePath(locale, `/lab/${entry.slug}#${WILD_VOICES_ANCHOR}`)}
          className="relative z-10 text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {dict.lab.wildLink.replace('{n}', String(clips))} →
        </Link>
      </div>
    </li>
  )
}
