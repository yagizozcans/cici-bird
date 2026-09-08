'use client'

import { useState } from 'react'
import { AudioPlayer } from './AudioPlayer'
import { getDictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'
import type { PlayableAudio } from '@/data/audio-manifest'
import type { Tier } from '@/data/species'
import { track } from '@/lib/analytics'

/**
 * The above-the-fold demo (website.md §3).
 *
 * The requirement is a short pre-recorded human sentence, the same sentence in
 * two or three bird voices, the decoded text as subtitle, and no signup —
 * plays immediately. The hard version of "understand it within five seconds"
 * is the COMPARISON, not either clip alone: the visitor has to hear the same
 * words twice to grasp that this is an encoding rather than a sound effect. So
 * the two players sit adjacent, sharing one sentence shown as text above both,
 * and the bird voices switch in place instead of being three separate cards.
 *
 * The tier badge on each voice does quiet work: it introduces the collection
 * mechanic before the visitor has read a single word about it.
 */

export interface DemoVoice {
  slug: string
  name: string
  tier: Tier
  accent: string
  audio: PlayableAudio
  decodeAccuracy: number
  /** True for a voice rendered by a trained model rather than the parametric
      encoder. The two decode differently, so the demo says which is which. */
  neural: boolean
}

export function HeroDemo({
  locale,
  human,
  humanText,
  voices,
}: {
  locale: Locale
  human: PlayableAudio
  humanText: string
  voices: DemoVoice[]
}) {
  const dict = getDictionary(locale)
  const [activeSlug, setActiveSlug] = useState(voices[0]?.slug)
  const active = voices.find((v) => v.slug === activeSlug) ?? voices[0]

  return (
    <div className="rounded-xl2 border border-line bg-white/70 p-5 shadow-[0_1px_0_rgba(22,21,15,0.03),0_12px_40px_-24px_rgba(22,21,15,0.25)] sm:p-6">
      {/* The sentence, as text, before either player. Sound-off legibility is
          a §3 requirement and this is the load-bearing part of it. */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {dict.demo.sourceCaption}
      </p>
      <p className="mt-2 text-balance text-[19px] leading-snug text-ink sm:text-[22px]">
        “{humanText}”
      </p>
      {/* Only the Turkish dictionary fills this in — see the note there. */}
      {dict.demo.alphabetNote && (
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          {dict.demo.alphabetNote}
        </p>
      )}

      <div className="mt-5 border-t border-line pt-5">
        <AudioPlayer
          audio={human}
          label={dict.demo.sourceLabel}
          variant="bar"
          accentColor="#6B675C"
          playLabel={dict.demo.play}
          pauseLabel={dict.demo.pause}
          analyticsEvent="demo_play"
          analyticsProps={{ clip: 'human' }}
        />
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {dict.demo.encodedLabel}
          </p>
        </div>

        {/* Voice picker. A radiogroup rather than tabs: the visitor is choosing
            which rendering to hear, and each option must announce its tier. */}
        <div
          role="radiogroup"
          aria-label={dict.demo.pick}
          className="mt-3 flex flex-wrap gap-2"
        >
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
          <div className="mt-5">
            {/* `key` forces a fresh player per voice: switching voices must
                stop the previous clip and reset position, not crossfade two
                messages into each other. */}
            <AudioPlayer
              key={active.slug}
              audio={active.audio}
              label={active.name}
              variant="feature"
              accentColor={active.accent}
              playLabel={dict.demo.play}
              pauseLabel={dict.demo.pause}
              subtitleHint={dict.demo.transcriptNote}
              analyticsEvent="demo_play"
              analyticsProps={{ clip: 'bird', voice: active.slug }}
            />

            <p className="mt-3 text-[12px] text-muted">
              <span className="font-medium text-ink">
                {dict.demo.accuracyLabel}: {Math.round(active.decodeAccuracy * 100)}%
              </span>{' '}
              —{' '}
              {active.neural ? dict.demo.accuracyNoteNeural : dict.demo.accuracyNote}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
