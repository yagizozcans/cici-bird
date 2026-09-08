'use client'

import type { ReactNode } from 'react'
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
 * The voice PICKER is not here. It moved to HeroStage, which owns the one
 * selection this card and the encoder beneath it both read — two pickers for
 * the same three birds, able to disagree, would be worse than none. This card
 * is told which voice is active and renders it.
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
  activeSlug,
  children,
}: {
  locale: Locale
  human: PlayableAudio
  humanText: string
  voices: DemoVoice[]
  activeSlug: string | undefined
  /** Rendered inside the card, under the demo — the interactive encoder. */
  children?: ReactNode
}) {
  const dict = getDictionary(locale)
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

      {children}
    </div>
  )
}
