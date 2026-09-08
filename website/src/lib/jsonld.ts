import { SITE, absoluteUrl } from './site'
import { LOCALE_TAG, localePath, type Locale } from '@/i18n/locale'
import { speciesName, type Species } from '@/data/species'
import type { AudioAsset } from '@/data/audio-manifest'
import { getDictionary } from '@/i18n/dictionary'

/**
 * Structured data (website.md §5: "structured data markup for each species
 * page").
 *
 * Three node types, chosen for what actually gets consumed rather than for
 * volume:
 *
 *  - BreadcrumbList — understood by every major engine, and the reason a
 *    species result can render as "cicibird.com › Species › Nightingale".
 *  - Taxon — the schema.org type that genuinely describes what the page is
 *    about, carrying the scientific name and both localized common names.
 *    Species names and taxonomic data are not copyrightable (app.md §6), so
 *    this is safe to publish in full.
 *  - AudioObject — one per clip, carrying its licence and credit straight from
 *    the asset manifest. This is the machine-readable half of the same
 *    attribution obligation the page renders visually.
 */

type Json = Record<string, unknown>

export function organizationLd(): Json {
  return {
    '@type': 'Organization',
    '@id': absoluteUrl('/#organization'),
    name: SITE.name,
    url: SITE.url,
    parentOrganization: { '@type': 'Organization', name: SITE.house.name },
  }
}

export function websiteLd(locale: Locale): Json {
  return {
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: SITE.name,
    url: SITE.url,
    inLanguage: LOCALE_TAG[locale],
    publisher: { '@id': absoluteUrl('/#organization') },
  }
}

export function breadcrumbLd(
  items: { name: string; path: string }[],
  locale: Locale,
): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(localePath(locale, item.path)),
    })),
  }
}

/**
 * One AudioObject, credited from the manifest.
 *
 * `license` is only emitted when provenance is verified. Publishing a licence
 * URL for an asset whose terms are still unconfirmed would be a machine-
 * readable claim we cannot back, which is worse than publishing nothing —
 * so unverified assets carry `creditText` describing the state instead.
 */
export function audioObjectLd(asset: AudioAsset, locale: Locale): Json {
  const node: Json = {
    '@type': 'AudioObject',
    '@id': absoluteUrl(`${asset.src}#audio`),
    name: asset.credit.title,
    contentUrl: absoluteUrl(asset.src),
    encodingFormat: asset.mime,
    inLanguage: LOCALE_TAG[locale],
    creditText: asset.credit.verified
      ? [asset.credit.recordist, asset.credit.source].filter(Boolean).join(' / ')
      : `${asset.credit.source} — licence and attribution pending verification`,
  }
  if (asset.durationSec) node.duration = isoDuration(asset.durationSec)
  if (asset.bytes) node.contentSize = `${Math.round(asset.bytes / 1024)}kB`
  if (asset.credit.verified && asset.credit.licenseUrl) {
    node.license = asset.credit.licenseUrl
  }
  if (asset.credit.sourceUrl) node.isBasedOn = asset.credit.sourceUrl
  if (asset.text) node.transcript = asset.text
  return node
}

export function speciesLd(
  species: Species,
  assets: AudioAsset[],
  locale: Locale,
): Json {
  const dict = getDictionary(locale)
  const url = absoluteUrl(localePath(locale, `/species/${species.slug}`))

  return {
    '@type': 'Taxon',
    '@id': `${url}#taxon`,
    url,
    name: speciesName(species, locale),
    // The OTHER common name plus the binomial. `name` already carries the
    // current locale's name, so repeating it here adds nothing; what earns its
    // place is the cross-language pair, which is what lets a Turkish query for
    // "bülbül" and an English one for "nightingale" reach the same page.
    alternateName: [species.names.en, species.names.tr, species.scientificName]
      .filter((n) => n !== speciesName(species, locale))
      .filter((n, i, all) => all.indexOf(n) === i),
    taxonRank: 'species',
    description: species.blurb[locale] || species.blurb.en,
    inLanguage: LOCALE_TAG[locale],
    additionalProperty: [
      prop(dict.species.unlockTitle, dict.species.tierNames[species.tier]),
      prop(
        dict.species.regions,
        species.regions.map((r) => dict.regions[r]).join(', '),
      ),
      prop(
        dict.species.seasons,
        species.seasons.map((s) => dict.seasons[s]).join(', '),
      ),
    ],
    subjectOf: assets.map((asset) => audioObjectLd(asset, locale)),
  }
}

function prop(name: string, value: string): Json {
  return { '@type': 'PropertyValue', name, value }
}

/** Seconds -> ISO 8601 duration, e.g. 3.36 -> "PT3.36S". */
function isoDuration(seconds: number): string {
  return `PT${Math.round(seconds * 100) / 100}S`
}

/**
 * Wrap nodes in a single @graph document.
 *
 * One script tag with a graph beats several disconnected ones: the @id
 * references between Taxon, WebSite and Organization only resolve when the
 * consumer sees them together.
 */
export function graph(nodes: Json[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
}
