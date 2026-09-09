'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import { useAudio, type AudioController } from './useAudio'
import { AudioPlayerView, type AudioPlayerViewProps } from './AudioPlayer'
import type { PlayableAudio } from '@/data/audio-manifest'
import { SCORE_HEIGHT, scoreX, type VoiceScore } from '@/lib/voice-score'

/**
 * The living mark on a trained species' page.
 *
 * The seven parametric species get a voice signature (lib/artwork.ts): one
 * invented note from a hand-authored profile. The three with a model get this
 * instead — the encoded message drawn as a score, and lit by the playhead
 * while it plays. Geometry comes from `lib/voice-score.ts`; this file only
 * decides which note is sounding.
 *
 * WHY A CONTEXT, for one page. The mark is in the identity section and the
 * player is in the audio section below it, and they must not disagree about
 * where the message is — two `useAudio` calls on one file is two playheads
 * and, worse, two clips that can play over each other. `AudioPlayerView`
 * exists for exactly this split (the Lab's voice space was the first case),
 * but the Lab's stage and bar are siblings inside one component and these two
 * are not. The provider renders no DOM of its own, so the page's layout is
 * unchanged by it.
 */

const PlayerContext = createContext<AudioController | null>(null)

export function LiveVoiceProvider({
  audio,
  speciesSlug,
  children,
}: {
  audio: PlayableAudio
  speciesSlug: string
  children: React.ReactNode
}) {
  const player = useAudio({
    src: audio.src,
    durationSec: audio.durationSec,
    analyticsEvent: 'sample_play',
    analyticsProps: { species: speciesSlug, surface: 'species-encoded' },
  })
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
}

function useSharedPlayer(): AudioController {
  const player = useContext(PlayerContext)
  if (!player) {
    throw new Error('LiveVoice parts must be rendered inside <LiveVoiceProvider>.')
  }
  return player
}

export function LiveVoiceMark({
  score,
  palette,
  label,
  caption,
}: {
  score: VoiceScore
  palette: { base: string; accent: string; wash: string }
  /** Accessible name, with the species already substituted in. */
  label: string
  caption: string
}) {
  const player = useSharedPlayer()
  const t = player.position
  // Before the first play the mark is just the mark, so nothing is dimmed to
  // "not yet sung" — a header cell of 22 faint notes reads as a broken image.
  const started = t > 0 || player.isPlaying
  const head = scoreX(t)
  const [lo, hi] = score.domain

  // The score is wider than any column it sits in, so the visitor can swipe
  // through the message — and while it plays, it swipes itself.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (!el || !started) return
    // Centred, not edge-following: the note being sung should have the notes
    // on either side of it visible, which is the whole reason to see a score
    // rather than a level meter. Set directly rather than with smooth
    // scrolling — `position` already arrives once a frame, and a queued smooth
    // scroll would spend every frame chasing the previous frame's target.
    el.scrollLeft = head - el.clientWidth / 2
  }, [head, started])

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-xl2 border border-line"
      style={{ backgroundColor: palette.wash }}
    >
      {/* `overscroll-x-contain` so a swipe that runs off the end of the score
          does not become the browser's back gesture. */}
      <div
        ref={scroller}
        className="flex flex-1 items-center overflow-x-auto overscroll-x-contain"
      >
      <svg
        width={score.width}
        height={SCORE_HEIGHT}
        viewBox={`0 0 ${score.width} ${SCORE_HEIGHT}`}
        className="block shrink-0"
        role="img"
        aria-label={label}
      >
        <path
          d={score.lanes}
          stroke={palette.base}
          strokeOpacity="0.09"
          strokeWidth="1"
          fill="none"
        />

        {score.notes.map((n, i) => {
          // `started` gates this: the first cue begins at t = 0, so without
          // it the opening note sits lit and glowing on a page nobody has
          // pressed play on yet.
          const sounding = started && t >= n.t0 && t < n.t1
          const sung = t >= n.t1
          // Loudness at this instant, from the note's own envelope — so the
          // glow swells and falls with the sound rather than blinking on.
          const k = (t - n.t0) / (n.t1 - n.t0 || 1)
          const e = sounding
            ? n.env[Math.max(0, Math.min(n.env.length - 1, Math.round(k * (n.env.length - 1))))]
            : 0

          return (
            <g key={i}>
              {sounding && (
                <circle
                  cx={n.px}
                  cy={n.py}
                  r={5 + e * 16}
                  fill={palette.accent}
                  opacity={0.08 + e * 0.2}
                />
              )}
              <path
                d={n.body}
                fill={sounding || sung ? palette.accent : palette.base}
                fillOpacity={sounding ? 1 : sung ? 0.62 : started ? 0.26 : 0.5}
                stroke={sounding ? palette.accent : 'none'}
                strokeWidth={sounding ? 2.5 : 0}
                strokeLinejoin="round"
              />
            </g>
          )
        })}

        {started && (
          <line
            x1={head}
            y1="0"
            x2={head}
            y2={SCORE_HEIGHT}
            stroke={palette.accent}
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
        )}
      </svg>
      </div>

      <p className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-line/70 px-3 py-2 font-mono text-[10px] text-muted">
        <span>{caption}</span>
        <span className="shrink-0 tabular-nums">
          {(lo / 1000).toFixed(1)}–{(hi / 1000).toFixed(1)} kHz
        </span>
      </p>
    </div>
  )
}

/** The message player under the mark, on the mark's playhead. */
export function LiveVoiceMessage(props: Omit<AudioPlayerViewProps, 'player'>) {
  const player = useSharedPlayer()
  return <AudioPlayerView {...props} player={player} />
}
