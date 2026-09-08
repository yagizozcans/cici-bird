import type { Locale } from '@/i18n/locale'
import {
  getAsset,
  getAssetOrNull,
  getTrainedVoice,
  type AudioAsset,
} from './audio-manifest'

import barnSwallow from './species/barn-swallow.json'
import bewicksWren from './species/bewicks-wren.json'
import blackbird from './species/blackbird.json'
import carrionCrow from './species/carrion-crow.json'
import hoopoe from './species/hoopoe.json'
import houseSparrow from './species/house-sparrow.json'
import nightingale from './species/nightingale.json'
import northernCardinal from './species/northern-cardinal.json'
import songSparrow from './species/song-sparrow.json'
import woodPigeon from './species/wood-pigeon.json'

/**
 * The species catalog.
 *
 * Ten species at launch: 3 starter, 5 basic, 2 premium. overview.md §7 sizes
 * the MVP catalog at "5–8 species total: 3 starter (free), 3–5 basic" — the
 * basic tier is now one past that range, and it grew for the same reason both
 * times: the song sparrow and the northern cardinal are the second and third
 * species with a trained model behind the voice, which is the thing this
 * catalog exists to show off. Each species is one JSON
 * file so adding a tenth is a content change, not a code change — app.md §6
 * is explicit that species onboarding has to be a repeatable pipeline, because
 * content cost is the binding constraint on catalog growth long before
 * engineering is.
 */

export type Tier = 'starter' | 'basic' | 'premium'
export type Region =
  | 'europe'
  | 'turkiye'
  | 'north-america'
  | 'north-africa'
  | 'central-asia'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type UnlockPath =
  | 'free'
  | 'field-or-purchase'
  | 'field-discount-or-purchase'
  | 'purchase-only'

export interface Species {
  slug: string
  scientificName: string
  names: Record<Locale, string>
  tier: Tier
  unlock: {
    path: UnlockPath
    /** Whether a wild recording can unlock it at all in this release. */
    findable: boolean
    priceNote: 'small' | 'premium' | null
    discountPct: number | null
  }
  /** Present only when `findable` is false, explaining why. */
  findableNote?: Record<Locale, string>
  regions: Region[]
  seasons: Season[]
  palette: { base: string; accent: string; wash: string }
  audio: { call: string; encoded: string }
  habitat: Record<Locale, string>
  blurb: Record<Locale, string>
  voiceNote: Record<Locale, string>
}

/** Catalog order: tier ascending, then the order a new user meets them. */
const RAW: unknown[] = [
  houseSparrow,
  woodPigeon,
  carrionCrow,
  barnSwallow,
  blackbird,
  bewicksWren,
  songSparrow,
  northernCardinal,
  nightingale,
  hoopoe,
]

export const SPECIES = RAW as Species[]

export const TIERS: Tier[] = ['starter', 'basic', 'premium']
export const REGIONS: Region[] = [
  'europe',
  'turkiye',
  'north-america',
  'north-africa',
  'central-asia',
]
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

export function allSpecies(): Species[] {
  return SPECIES
}

export function speciesSlugs(): string[] {
  return SPECIES.map((s) => s.slug)
}

export function getSpecies(slug: string): Species | null {
  return SPECIES.find((s) => s.slug === slug) ?? null
}

export function speciesName(species: Species, locale: Locale): string {
  return species.names[locale] || species.names.en
}

/**
 * Whether a species has a trained voice behind it yet.
 *
 * Seven of the ten species are still rendered by the parametric encoder in
 * engine/voices.py — a hand-authored profile, not a model fitted to that
 * bird's recordings. A parametric voice is a placeholder: the timbre is
 * invented, and the decode accuracy on its page describes the placeholder
 * rather than the species. So until a checkpoint exists, the site says "soon"
 * and refuses to send anyone to a page of numbers that are not about the bird
 * named at the top of it.
 *
 * Keyed off the manifest's trainedVoices rather than a hand-kept list, so
 * finishing a fourth model releases its page by regenerating the manifest —
 * the same "data change, not a code change" rule the catalog itself follows.
 */
export function hasTrainedVoice(species: Species): boolean {
  return getTrainedVoice(species.slug) !== null
}

/** Slug → whether its page is live, for handing to client components. */
export function trainedMap(species: Species[]): Record<string, boolean> {
  return Object.fromEntries(species.map((s) => [s.slug, hasTrainedVoice(s)]))
}

/** True when a species is present in every season we model. */
export function isResident(species: Species): boolean {
  return species.seasons.length === SEASONS.length
}

export interface CatalogFilter {
  tier?: Tier | null
  region?: Region | null
  season?: Season | null
}

/**
 * §5's "filterable by tier, region, and season".
 *
 * Filters intersect rather than union: picking Türkiye and Winter asks "what
 * can I actually go and find near me right now", which is the question the
 * collection loop turns on. A union would answer a question nobody has.
 */
export function filterSpecies(
  species: Species[],
  filter: CatalogFilter,
): Species[] {
  return species.filter((s) => {
    if (filter.tier && s.tier !== filter.tier) return false
    if (filter.region && !s.regions.includes(filter.region)) return false
    if (filter.season && !s.seasons.includes(filter.season)) return false
    return true
  })
}

/** Every credited audio asset attached to a species, for the credits block. */
export function speciesAssets(species: Species): AudioAsset[] {
  return [species.audio.call, species.audio.encoded]
    .map((id) => getAssetOrNull(id))
    .filter((a): a is AudioAsset => a !== null)
}

export function speciesCall(species: Species): AudioAsset {
  return getAsset(species.audio.call)
}

export function speciesEncoded(species: Species): AudioAsset {
  return getAsset(species.audio.encoded)
}
