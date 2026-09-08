'use client'

import { useAudio, type AudioController } from './useAudio'
import { SubtitleTrack } from './SubtitleTrack'
import type { PlayableAudio } from '@/data/audio-manifest'
import type { AnalyticsEvent } from '@/lib/analytics'

/**
 * The play control used everywhere on the site.
 *
 * Three shapes, one behaviour:
 *   `button`  — an icon button for a catalog card
 *   `bar`     — button plus label, duration and progress, for a species page
 *   `feature` — the above plus a synchronized subtitle, for the hero demo
 *               and the shared message player
 *
 * Accessibility is not an add-on here. website.md §3 requires the page to be
 * "fully usable with sound off", and app.md §10 makes subtitles the primary
 * comprehension path — so every player states its label and duration in text,
 * and every subtitle has the full transcript visible underneath, not revealed
 * on play.
 *
 * Two exports. `AudioPlayer` owns its player and is what every page uses.
 * `AudioPlayerView` is the same chrome over a player someone else owns — for
 * the one case where a sibling needs the playhead too. The Lab's voice space
 * lights up a letter as it is sung and seeks when a letter is clicked, so it
 * has to share `position` and `seek` with the bar beneath it. A callback prop
 * could report position but not expose seek, and an optional `player` prop
 * would leave a dead `useAudio` call behind (hooks cannot be conditional), so
 * the split is the honest shape.
 */

interface Props {
  audio: PlayableAudio
  label: string
  variant?: 'button' | 'bar' | 'feature'
  /** Shown under the control in `bar`/`feature`. */
  caption?: string
  accentColor?: string
  analyticsEvent?: AnalyticsEvent
  analyticsProps?: Record<string, string | number | boolean>
  playLabel: string
  pauseLabel: string
  subtitleHint?: string
  className?: string
}

export function AudioPlayer({ audio, analyticsEvent, analyticsProps, ...rest }: Props) {
  const player = useAudio({
    src: audio.src,
    durationSec: audio.durationSec,
    analyticsEvent,
    analyticsProps,
  })
  return <AudioPlayerView audio={audio} player={player} {...rest} />
}

export type AudioPlayerViewProps = Omit<Props, 'analyticsEvent' | 'analyticsProps'> & {
  player: AudioController
}

export function AudioPlayerView({
  audio,
  player,
  label,
  variant = 'bar',
  caption,
  accentColor = '#B8791B',
  playLabel,
  pauseLabel,
  subtitleHint,
  className = '',
}: AudioPlayerViewProps) {
  const progress = player.duration
    ? Math.min(player.position / player.duration, 1)
    : 0
  const actionLabel = player.isPlaying ? pauseLabel : playLabel

  const control = (
    <button
      type="button"
      onClick={player.toggle}
      aria-label={`${actionLabel}: ${label}`}
      className={
        variant === 'button'
          ? 'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-paper/90 text-ink shadow-sm transition hover:border-ochre hover:text-ochre-deep active:scale-95'
          : 'grid h-12 w-12 shrink-0 place-items-center rounded-full text-paper shadow-sm transition hover:brightness-110 active:scale-95'
      }
      style={variant === 'button' ? undefined : { backgroundColor: accentColor }}
    >
      {player.state === 'loading' ? (
        <Spinner />
      ) : player.isPlaying ? (
        <PauseIcon />
      ) : (
        <PlayIcon />
      )}
    </button>
  )

  if (variant === 'button') return control

  return (
    <div className={className}>
      <div className="flex items-center gap-4">
        {control}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] font-medium text-ink">
              {label}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
              {formatTime(player.position)} / {formatTime(player.duration)}
            </span>
          </div>

          {/* Progress doubles as a seek bar. It is a real slider so it is
              keyboard-operable, not a decorative div. */}
          <input
            type="range"
            min={0}
            max={player.duration || 1}
            step={0.01}
            value={player.position}
            onChange={(e) => player.seek(Number(e.target.value))}
            aria-label={`Seek: ${label}`}
            className="mt-2 block h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-ochre [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
            style={{
              background: `linear-gradient(to right, ${accentColor} ${progress * 100}%, #E4E0D6 ${progress * 100}%)`,
            }}
          />

          {caption && <p className="mt-2 text-[12px] text-muted">{caption}</p>}
          {player.state === 'error' && (
            <p className="mt-2 text-[12px] text-red-700">
              This clip could not be loaded. The transcript below is complete.
            </p>
          )}
        </div>
      </div>

      {variant === 'feature' && audio.cues.length > 0 && (
        <SubtitleTrack
          cues={audio.cues}
          wordCues={audio.wordCues}
          fullText={audio.text ?? ''}
          position={player.position}
          isPlaying={player.isPlaying}
          accentColor={accentColor}
          hint={subtitleHint}
        />
      )}
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function PlayIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
      <path d="M1 1.6c0-.8.9-1.3 1.6-.9l10 6.4c.6.4.6 1.4 0 1.8l-10 6.4c-.7.4-1.6-.1-1.6-.9V1.6Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
      <rect x="1.5" y="1" width="3.6" height="14" rx="1.2" />
      <rect x="8.9" y="1" width="3.6" height="14" rx="1.2" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
