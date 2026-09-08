'use client'

import { useState, type ReactNode } from 'react'
import { HeroDemo, type DemoVoice } from './HeroDemo'
import { InteractiveEncoder } from './InteractiveEncoder'
import { getDictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'
import type { PlayableAudio } from '@/data/audio-manifest'
import { track } from '@/lib/analytics'

/**
 * The above-the-fold stage: pick a bird on the left, hear it on the right.
 *
 * ONE SELECTION, TWO COLUMNS is why this component exists at all. The picker
 * and the players sit in different grid cells, so the shared `activeSlug` has
 * to live in a common client parent — and since the cells are siblings in one
 * grid, that parent has to own the grid. The heading arrives as `children`,
 * still rendered on the server.
 *
 * ORDERING DIFFERS BY BREAKPOINT, and that is deliberate. website.md §3 wants
 * the one-liner and the demo above the fold on a phone, where most traffic
 * arrives from a shared link. A plain two-column grid stacks into heading,
 * selector, demo — which asks the visitor to choose a bird before they have
 * heard one. So the demo is ordered second on small screens and explicit grid
 * placement restores the two-column reading on large ones.
 *
 * The install buttons used to hold the lower-left cell. They now appear only in
 * the footer: §3's "one-liner, then demo, then install" no longer describes
 * this page, and the selector earns the space by making the demo interactive
 * rather than repeating a call to action the visitor has not been sold on yet.
 */

export interface HeroVoice extends DemoVoice {
  scientificName: string
  voiceNote: string
  /** Clips the model was fitted to, from the manifest's trainedVoices. */
  corpusSize: number | null
}

export function HeroStage({
  locale,
  voices,
  human,
  humanText,
  encoderAvailable,
  children,
}: {
  locale: Locale
  voices: HeroVoice[]
  human: PlayableAudio
  humanText: string
  encoderAvailable: boolean
  children: ReactNode
}) {
  const dict = getDictionary(locale)
  const [activeSlug, setActiveSlug] = useState(voices[0]?.slug)
  const active = voices.find((voice) => voice.slug === activeSlug) ?? voices[0]

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8">
      <div className="order-1 lg:col-start-1 lg:row-start-1 lg:pt-6">{children}</div>

      <div className="order-3 lg:col-start-1 lg:row-start-2">
        {/* A radiogroup rather than tabs: the visitor is choosing which voice
            to hear and to write in, and each option must announce its tier. */}
        <div role="radiogroup" aria-label={dict.demo.pick} className="flex flex-wrap gap-2">
          {voices.map((voice) => {
            const selected = voice.slug === active?.slug
            return (
              <button
                key={voice.slug}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setActiveSlug(voice.slug)
                  track('demo_voice_switch', { voice: voice.slug })
                }}
                className={`group flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] transition ${
                  selected
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-paper text-ink hover:border-ink/40'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: voice.accent }}
                />
                <span className="font-medium">{voice.name}</span>
                {voice.neural && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      selected ? 'bg-paper/20 text-paper' : 'bg-ochre/15 text-ochre-deep'
                    }`}
                  >
                    {dict.demo.neuralTag}
                  </span>
                )}
                <span
                  className={`text-[10px] uppercase tracking-wide ${
                    selected ? 'text-paper/60' : 'text-muted'
                  }`}
                >
                  {dict.species.tierNames[voice.tier]}
                </span>
              </button>
            )
          })}
        </div>

        {active && (
          <div className="mt-4 rounded-xl2 border border-line bg-white/40 p-4">
            <p className="text-[15px] font-medium text-ink">{active.name}</p>
            <p className="text-[12px] italic text-muted">{active.scientificName}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/85">{active.voiceNote}</p>
            {active.corpusSize !== null && (
              <p className="mt-2 text-[11px] uppercase tracking-wide text-muted">
                {dict.encoder.trainedOnLabel}:{' '}
                {dict.encoder.clips.replace('{n}', String(active.corpusSize))}
              </p>
            )}
          </div>
        )}
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
          human={human}
          humanText={humanText}
          voices={voices}
          activeSlug={activeSlug}
        >
          {active && (
            <InteractiveEncoder
              locale={locale}
              voice={active}
              available={encoderAvailable}
              // The demo card above states it already; twice in one card is noise.
              showAlphabetNote={false}
              className="mt-6 border-t border-line pt-5"
            />
          )}
        </HeroDemo>
      </div>
    </div>
  )
}
