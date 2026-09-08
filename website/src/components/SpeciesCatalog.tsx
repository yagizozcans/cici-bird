'use client'

import { useMemo, useState } from 'react'
import { SpeciesCard } from './SpeciesCard'
import { getDictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'
import {
  REGIONS,
  SEASONS,
  TIERS,
  filterSpecies,
  type Region,
  type Season,
  type Species,
  type Tier,
} from '@/data/species'
import type { PlayableAudio } from '@/data/audio-manifest'
import { track } from '@/lib/analytics'

/**
 * The catalog grid and its filters (website.md §5).
 *
 * Filtering happens in the browser over a list the SERVER already rendered in
 * full. That ordering matters for both of the jobs this page has: a crawler
 * and a sound-off visitor see every species in the initial HTML, and a visitor
 * with JavaScript gets instant filtering with no round trip. Filtering
 * server-side via searchParams would have made the page dynamic and shipped a
 * blank grid to anyone whose JS had not run.
 *
 * The selected filters are written to the URL so a filtered view is
 * shareable — "here is what you can find in Türkiye in winter" is a link worth
 * sending, and it is the same link the app's own regional view would produce.
 */
export function SpeciesCatalog({
  species,
  samples,
  trained,
  locale,
}: {
  species: Species[]
  /** Keyed by slug, and present only for species with a trained voice. */
  samples: Record<string, PlayableAudio>
  /** Slug → whether its voice is trained, computed server-side. */
  trained: Record<string, boolean>
  locale: Locale
}) {
  const dict = getDictionary(locale)
  const [tier, setTier] = useState<Tier | null>(null)
  const [region, setRegion] = useState<Region | null>(null)
  const [season, setSeason] = useState<Season | null>(null)

  const visible = useMemo(
    () => filterSpecies(species, { tier, region, season }),
    [species, tier, region, season],
  )

  const active = tier !== null || region !== null || season !== null

  function apply<T extends string>(
    kind: 'tier' | 'region' | 'season',
    value: T | null,
    setter: (v: T | null) => void,
  ) {
    setter(value)
    if (value) track('species_filter', { kind, value })

    // Reflect the selection in the URL without a navigation, so Back does not
    // become "undo one filter click" fourteen times over.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (value) url.searchParams.set(kind, value)
      else url.searchParams.delete(kind)
      window.history.replaceState(null, '', url)
    }
  }

  function reset() {
    setTier(null)
    setRegion(null)
    setSeason(null)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.search = ''
      window.history.replaceState(null, '', url)
    }
  }

  return (
    <>
      <div className="border-y border-line bg-white/50">
        <div className="wrap flex flex-col gap-4 py-5">
          <FilterRow
            label={dict.catalog.filterTier}
            allLabel={dict.catalog.filterAll}
            options={TIERS.map((t) => ({
              value: t,
              label: dict.species.tierNames[t],
            }))}
            selected={tier}
            onSelect={(v) => apply('tier', v, setTier)}
          />
          <FilterRow
            label={dict.catalog.filterRegion}
            allLabel={dict.catalog.filterAll}
            options={REGIONS.map((r) => ({ value: r, label: dict.regions[r] }))}
            selected={region}
            onSelect={(v) => apply('region', v, setRegion)}
          />
          <FilterRow
            label={dict.catalog.filterSeason}
            allLabel={dict.catalog.filterAll}
            options={SEASONS.map((s) => ({ value: s, label: dict.seasons[s] }))}
            selected={season}
            onSelect={(v) => apply('season', v, setSeason)}
          />

          <div className="flex items-center justify-between gap-4 pt-1">
            {/* Politely announced, so a screen-reader user learns the result
                count changed without the grid being re-read from the top. */}
            <p aria-live="polite" className="text-[12px] text-muted">
              {dict.catalog.showing} {visible.length} {dict.catalog.of}{' '}
              {species.length} {dict.catalog.resultsMany}
            </p>
            {active && (
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-line px-3 py-1.5 text-[12px] text-ink transition hover:border-ink/40"
              >
                {dict.catalog.reset}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="wrap py-10">
        {visible.length === 0 ? (
          <div className="rounded-xl2 border border-dashed border-line px-6 py-16 text-center">
            <p className="text-[15px] text-ink">{dict.catalog.empty}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-paper transition hover:bg-ink/85"
            >
              {dict.catalog.reset}
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => (
              <li key={s.slug}>
                <SpeciesCard
                  species={s}
                  locale={locale}
                  sample={samples[s.slug] ?? null}
                  ready={trained[s.slug] === true}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function FilterRow<T extends string>({
  label,
  allLabel,
  options,
  selected,
  onSelect,
}: {
  label: string
  allLabel: string
  options: { value: T; label: string }[]
  selected: T | null
  onSelect: (value: T | null) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        <Chip active={selected === null} onClick={() => onSelect(null)}>
          {allLabel}
        </Chip>
        {options.map((option) => (
          <Chip
            key={option.value}
            active={selected === option.value}
            onClick={() =>
              onSelect(selected === option.value ? null : option.value)
            }
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-line bg-paper text-muted hover:border-ink/30 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
