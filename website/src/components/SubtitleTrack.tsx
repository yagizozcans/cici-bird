'use client'

import { useMemo } from 'react'
import type { Cue } from '@/data/audio-manifest'

/**
 * The decoded subtitle, synchronized to playback.
 *
 * This is the component the whole product rests on. app.md §4.3: "the audio is
 * the experience; the transmitted text is the guarantee", and §10 makes
 * subtitles the primary comprehension path — so the design rule here is that
 * the FULL text is present and legible at all times, and playback only adds
 * emphasis to it. Nothing is hidden until sung. A visitor with sound off, or
 * with autoplay blocked, or on a failed audio fetch, still reads the whole
 * message.
 *
 * Timings are exact rather than interpolated: `cues` comes from the audio
 * manifest, where they were derived from the codec's fixed 120 ms symbol grid
 * at synthesis time. The browser is not guessing where a character falls.
 */

export function SubtitleTrack({
  cues,
  wordCues,
  fullText,
  position,
  isPlaying,
  accentColor,
  hint,
}: {
  cues: Cue[]
  wordCues: Cue[]
  fullText: string
  position: number
  isPlaying: boolean
  accentColor: string
  hint?: string
}) {
  // How many characters have been sung. Cues are ordered and contiguous, so a
  // count of elapsed cues is all the state the reveal needs.
  const sungCount = useMemo(() => {
    if (position <= 0) return 0
    let count = 0
    for (const cue of cues) {
      if (cue.t0 < position) count++
      else break
    }
    return count
  }, [cues, position])

  const sungText = cues
    .slice(0, sungCount)
    .map((c) => c.text)
    .join('')
  const displayText = cues.map((c) => c.text).join('') || fullText

  const activeWord = useMemo(
    () => wordCues.find((w) => position >= w.t0 && position < w.t1)?.text ?? null,
    [wordCues, position],
  )

  return (
    <div className="mt-5">
      <div className="rounded-xl2 border border-line bg-white/70 px-5 py-4">
        {/* Two layers in one grid cell: the complete transcript in a muted
            tone, and the sung-so-far portion painted over it in the species'
            accent. Identical text, identical metrics, so nothing reflows and
            the characters cannot drift apart. */}
        <p className="subtitle-stack font-mono text-[15px] leading-relaxed sm:text-base">
          <span aria-hidden="true" className="text-ink/40">
            {displayText}
          </span>
          <span
            aria-hidden="true"
            className="transition-colors"
            style={{ color: accentColor }}
          >
            {sungText}
            <span className="text-transparent">{displayText.slice(sungCount)}</span>
          </span>

          {/* The accessible copy: one clean string, not the two visual layers.
              A screen reader gets the whole message immediately rather than a
              character-by-character stream, which would be unusable. */}
          <span className="sr-only">{displayText}</span>
        </p>

        {/* Announced separately and politely, so a screen-reader user tracking
            playback hears words as they are sung without the full text being
            re-read on every frame. */}
        <span aria-live="polite" aria-atomic="true" className="sr-only">
          {isPlaying && activeWord ? activeWord : ''}
        </span>
      </div>

      {hint && <p className="mt-2 text-[12px] text-muted">{hint}</p>}
    </div>
  )
}
