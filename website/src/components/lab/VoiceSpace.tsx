'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type { VoiceSpaceData } from '@/data/lab-types'
import type { PlayableAudio } from '@/data/audio-manifest'
import type { Dictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'
import { useAudio } from '@/components/useAudio'
import { InteractiveEncoder, type EncoderVoice } from '@/components/InteractiveEncoder'
import { AudioPlayerView } from '@/components/AudioPlayer'
import {
  AXIS_VIEWS,
  DEFAULT_VIEW,
  ELEVATION_RANGE,
  activeCueIndex,
  collapsedAxis,
  contourDomain,
  layoutVoiceSpace,
  letterIndex,
  nearestYaw,
  sameView,
  sungCount,
  type AxisKey,
  type ViewAngles,
} from '@/lib/voice-space'
import { VoiceSpaceStage } from './VoiceSpaceStage'
import { LetterReadout, type ReadoutState } from './LetterReadout'

/**
 * One bird's voice space, live. The same component for every bird — the
 * measurement is the same measurement, only the numbers differ.
 *
 * Three things happen here and nowhere else:
 *
 * 1. The player is OWNED by this component rather than by `AudioPlayer`,
 *    because the plot needs the playhead (to light the letter being sung)
 *    and `seek` (to jump when a point is clicked). The bar underneath gets
 *    the same player through `AudioPlayerView`, so the subtitle and the plot
 *    can never disagree about where the message is.
 *
 * 2. Which letter is "on" comes from the cues the audio build wrote — real
 *    note spans measured while the model sang, including the silence between
 *    notes. Between notes the plot shows nothing lit and the panel says so;
 *    that gap is the bird articulating, not a glitch.
 *
 * 3. A message the VISITOR wrote joins the chips like any other, because the
 *    plot cannot tell the difference: the lighting is driven entirely by
 *    `asset.cues`, and the encoder renders through the same checkpoint this
 *    page's data was measured against. So the encoder hands its result up
 *    here rather than playing it itself — one player, one playhead, and the
 *    visitor's own sentence lights the same 31 points.
 *
 * 4. The data arrives as a PROP, from the server component that read it
 *    through `data/lab.ts` (which no client module may import — it pulls the
 *    ~100 KB audio manifest in with it). Importing the JSON here instead
 *    would keep it out of the RSC payload, which is what this file did while
 *    the Lab had one bird; with several, ES imports are static, so every
 *    bird's data would land in the one `/lab/[slug]` chunk no matter which
 *    entry is being read. A prop costs ~15 KB of document and carries only
 *    the bird on the page.
 */

/** Button order: the two flat axes first, then the vertical one. */
const AXIS_KEYS = ['slope', 'duration', 'pitch'] as const satisfies readonly AxisKey[]

type Copy = Dictionary['lab']['voiceSpace']

interface Props {
  data: VoiceSpaceData
  copy: Copy
  /**
   * The plot's accessible name, with the species already substituted in.
   * It arrives resolved rather than as `copy.stageLabel` because the copy is
   * written for any bird and only the server knows which one this is.
   */
  stageLabel: string
  /** Messages to sync to, in chip order. */
  messages: PlayableAudio[]
  palette: { base: string; accent: string; wash: string }
  playLabel: string
  pauseLabel: string
  subtitleHint?: string
  /** Present on the lab pages: lets the visitor add a message of their own. */
  encoder?: { locale: Locale; voice: EncoderVoice; available: boolean }
}

export function VoiceSpace({
  data,
  copy,
  stageLabel,
  messages,
  palette,
  playLabel,
  pauseLabel,
  subtitleHint,
  encoder,
}: Props) {
  // One slot, not a growing list: a second encode replaces the first, so the
  // chip row stays the built messages plus at most "yours".
  const [mine, setMine] = useState<PlayableAudio | null>(null)
  const all = mine ? [...messages, mine] : messages
  const [activeId, setActiveId] = useState(messages[0].id)
  const asset = all.find((m) => m.id === activeId) ?? all[0]

  // The view lives here, above the per-message session, so switching
  // messages keeps whatever angle the visitor has turned the plot to.
  const [view, setView] = useState<ViewAngles>(DEFAULT_VIEW)
  const isDefault = sameView(view, DEFAULT_VIEW)
  const locked = collapsedAxis(view)
  const layout = useMemo(() => layoutVoiceSpace(data, view, palette), [data, view, palette])
  // One pitch range for all 31 sparklines, so their shapes are comparable.
  const f0Domain = useMemo(() => contourDomain(data.letters), [data])

  // Latest view, for callbacks that must not be rebuilt on every frame of a
  // glide (which would restart the very animation they started).
  const viewRef = useRef(view)
  viewRef.current = view
  const animRef = useRef<number | null>(null)

  const stopGlide = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
  }, [])
  useEffect(() => stopGlide, [stopGlide])

  /**
   * Turn the plot to a given camera position over about half a second.
   *
   * This is the one animation on the page and the one place a rAF loop runs,
   * so it checks `prefers-reduced-motion` itself — globals.css collapses CSS
   * transitions under that setting but cannot reach a JS loop. Reduced
   * motion gets the destination immediately, which is the same information
   * without the travel.
   */
  const glideTo = useCallback(
    (to: ViewAngles) => {
      stopGlide()
      const from = viewRef.current
      // Take the nearest turn of the target yaw, so locking an axis never
      // spins the plot most of the way round to reach an identical view.
      const target = { yaw: nearestYaw(from.yaw, to.yaw), elevation: to.elevation }
      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduce) {
        setView(target)
        return
      }
      const t0 = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 520)
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
        setView({
          yaw: from.yaw + (target.yaw - from.yaw) * e,
          elevation: from.elevation + (target.elevation - from.elevation) * e,
        })
        animRef.current = k < 1 ? requestAnimationFrame(step) : null
      }
      animRef.current = requestAnimationFrame(step)
    },
    [stopGlide],
  )

  const gesture = useRef<{ x: number; y: number; view: ViewAngles; moved: boolean } | null>(
    null,
  )
  // Set on pointer-up if the gesture moved, read and cleared by the next
  // click — so a drag that happens to end on a point does not select it.
  const dragged = useRef(false)

  const onPointerDown = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      // A hand on the plot outranks a glide in progress.
      stopGlide()
      // Capture so a drag keeps rotating when the pointer leaves the plot.
      // Some browsers throw for an id they no longer track (and synthetic
      // events always do); losing capture is not worth losing the drag.
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* uncaptured drag still works while the pointer stays on the plot */
      }
      gesture.current = { x: e.clientX, y: e.clientY, view, moved: false }
      dragged.current = false
    },
    [view, stopGlide],
  )
  const onPointerMove = useCallback((e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.moved && Math.abs(dx) + Math.abs(dy) < 4) return
    g.moved = true
    setView({
      yaw: g.view.yaw + dx * 0.01,
      elevation: clamp(g.view.elevation + dy * 0.01, ELEVATION_RANGE),
    })
  }, [])
  const onPointerUp = useCallback(() => {
    dragged.current = gesture.current?.moved ?? false
    gesture.current = null
  }, [])
  const onKeyDown = useCallback(
    (e: KeyboardEvent<SVGSVGElement>) => {
      const step = 0.1
      const turn: Record<string, (v: ViewAngles) => ViewAngles> = {
        ArrowLeft: (v) => ({ ...v, yaw: v.yaw - step }),
        ArrowRight: (v) => ({ ...v, yaw: v.yaw + step }),
        ArrowUp: (v) => ({ ...v, elevation: clamp(v.elevation - step, ELEVATION_RANGE) }),
        ArrowDown: (v) => ({ ...v, elevation: clamp(v.elevation + step, ELEVATION_RANGE) }),
      }
      const fn = turn[e.key]
      if (!fn) return
      e.preventDefault()
      stopGlide()
      setView(fn)
    },
    [stopGlide],
  )

  return (
    <div>
      {/* Message picker. A radiogroup, as on the landing demo: the visitor is
          choosing which recording to hear, not switching a view. */}
      <div
        role="radiogroup"
        aria-label={copy.chooseMessage}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {copy.chooseMessage}
        </span>
        {all.map((m) => {
          const on = m.id === asset.id
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setActiveId(m.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                on
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-paper text-ink hover:border-ink/40'
              }`}
            >
              “{m.text}”
            </button>
          )
        })}
      </div>

      {/* Remounting per message gives a fresh player and an empty trail —
          the same trick HeroDemo uses when the voice changes. */}
      <Session
        key={asset.id}
        data={data}
        asset={asset}
        copy={copy}
        stageLabel={stageLabel}
        palette={palette}
        layout={layout}
        f0Domain={f0Domain}
        isDefaultView={isDefault}
        onResetView={() => glideTo(DEFAULT_VIEW)}
        locked={locked}
        onLockAxis={(k) => glideTo(AXIS_VIEWS[k])}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        dragged={dragged}
        playLabel={playLabel}
        pauseLabel={pauseLabel}
        subtitleHint={subtitleHint}
      />

      {encoder && (
        <InteractiveEncoder
          locale={encoder.locale}
          voice={encoder.voice}
          available={encoder.available}
          className="mt-10 max-w-measure"
          onResult={(audio) => {
            setMine(audio)
            setActiveId(audio.id)
          }}
        />
      )}
    </div>
  )
}

interface SessionProps {
  data: VoiceSpaceData
  asset: PlayableAudio
  copy: Copy
  stageLabel: string
  palette: Props['palette']
  layout: ReturnType<typeof layoutVoiceSpace>
  f0Domain: [number, number]
  isDefaultView: boolean
  onResetView: () => void
  /** The axis currently pointing at the viewer, if the view is square to one. */
  locked: AxisKey | null
  onLockAxis: (axis: AxisKey) => void
  onPointerDown: (e: PointerEvent<SVGSVGElement>) => void
  onPointerMove: (e: PointerEvent<SVGSVGElement>) => void
  onPointerUp: (e: PointerEvent<SVGSVGElement>) => void
  onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => void
  dragged: React.MutableRefObject<boolean>
  playLabel: string
  pauseLabel: string
  subtitleHint?: string
}

function Session({
  data,
  asset,
  copy,
  stageLabel,
  palette,
  layout,
  f0Domain,
  isDefaultView,
  onResetView,
  locked,
  onLockAxis,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  dragged,
  playLabel,
  pauseLabel,
  subtitleHint,
}: SessionProps) {
  const player = useAudio({
    src: asset.src,
    durationSec: asset.durationSec,
    analyticsEvent: 'sample_play',
    analyticsProps: {
      species: data.meta.speciesSlug,
      surface: 'lab-voice-space',
      asset: asset.id,
    },
  })
  const [selected, setSelected] = useState(-1)
  const [note, setNote] = useState<string | null>(null)

  // A space has a cue — the manifest gives the word pause a span so the
  // subtitle can time it — but the trained voice never SINGS a space; it
  // rests. So a space cue is silence here: nothing lights, nothing joins the
  // trail. (The space still has a point in the plot: the model was handed a
  // motif for it, because the codec's alphabet has one. It is never used.)
  const cues = asset.cues
  const sungIndex = (text: string) => (text === ' ' ? -1 : letterIndex(text))
  const cueIdx = activeCueIndex(cues, player.position)
  const active = cueIdx < 0 ? -1 : sungIndex(cues[cueIdx].text)
  const sung = sungCount(cues, player.position)
  const lastSung = (() => {
    for (let i = sung - 1; i >= 0; i--) {
      const idx = sungIndex(cues[i].text)
      if (idx >= 0) return idx
    }
    return -1
  })()
  const trail = useMemo(
    () => cues.slice(0, sung).map((c) => sungIndex(c.text)).filter((i) => i >= 0),
    [cues, sung],
  )

  // What the panel shows. While playing, the sung letter wins; in a gap it
  // keeps the last letter and says "between notes" rather than going blank
  // thirty times a message. Otherwise the visitor's pick, or nothing.
  let shown = -1
  let state: ReadoutState = 'idle'
  if (player.isPlaying) {
    shown = active >= 0 ? active : lastSung
    state = active >= 0 ? 'singing' : 'silence'
  } else if (selected >= 0) {
    shown = selected
    state = 'selected'
  } else if (lastSung >= 0) {
    shown = lastSung
    state = 'idle'
  }

  const onSelect = useCallback(
    (i: number) => {
      if (dragged.current) {
        dragged.current = false
        return
      }
      setSelected(i)
      const cue = cues.find((c) => letterIndex(c.text) === i)
      if (cue) {
        setNote(null)
        // Before the first play there is no audio element yet and seek is a
        // no-op — the point is selected, and play still starts from the top.
        // Never starts playback: website.md §3, audio must not autoplay.
        player.seek(cue.t0)
      } else {
        setNote(copy.notInMessage)
      }
    },
    [cues, player, copy.notInMessage, dragged],
  )

  return (
    <>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className="relative rounded-xl2 border border-line p-2 sm:p-3"
          style={{ backgroundColor: palette.wash }}
        >
          {/* Square up on one axis. Each button turns the plot until its axis
              points at the viewer, which flattens the cloud into the plain 2D
              scatter of the other two — the view that shows, rather than
              asserts, how those two are related. */}
          <div
            role="group"
            aria-label={copy.views.groupLabel}
            className="absolute right-3 top-3 z-10 flex gap-1"
          >
            {AXIS_KEYS.map((k) => {
              const on = locked === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onLockAxis(k)}
                  aria-pressed={on}
                  title={copy.views[`${k}Title` as const]}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    on
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line bg-paper/80 text-muted hover:border-ink/40 hover:text-ink'
                  }`}
                >
                  {copy.views[k]}
                </button>
              )
            })}
          </div>

          <VoiceSpaceStage
            layout={layout}
            activeIndex={player.isPlaying ? active : -1}
            trail={trail}
            selected={selected}
            accent={palette.accent}
            halo={palette.wash}
            labels={{
              slope: copy.axes.slope,
              slopeUnit: copy.axes.slopeUnit,
              duration: copy.axes.duration,
              durationUnit: copy.axes.durationUnit,
              pitch: copy.axes.pitch,
              pitchUnit: copy.axes.pitchUnit,
              ariaLabel: stageLabel,
              pointLabelPrefix: copy.pointLabelPrefix,
              spaceGlyph: copy.spaceGlyph,
            }}
            onSelect={onSelect}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pb-1 pt-2 text-[11px] text-muted">
            <span>{copy.dragHint}</span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-10 rounded-full"
                style={{
                  background: `linear-gradient(to right, ${palette.base}, #B8791B)`,
                }}
              />
              {copy.axes.colour}
            </span>
            <span>{copy.axes.size}</span>
            {!isDefaultView && (
              <button
                type="button"
                onClick={onResetView}
                className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] text-ink transition hover:border-ink/40"
              >
                {copy.resetView}
              </button>
            )}
          </div>
        </div>

        <LetterReadout
          letter={shown >= 0 ? data.letters[shown] : null}
          state={state}
          libNotes={data.meta.libNotes}
          f0Domain={f0Domain}
          accent={palette.accent}
          copy={copy.readout}
          note={state === 'selected' ? note : null}
        />
      </div>

      <AudioPlayerView
        audio={asset}
        player={player}
        variant="feature"
        label={asset.text ?? asset.id}
        accentColor={palette.accent}
        playLabel={playLabel}
        pauseLabel={pauseLabel}
        subtitleHint={subtitleHint}
        className="mt-4 rounded-xl2 border border-line bg-white/70 p-5"
      />
    </>
  )
}

function clamp(v: number, [lo, hi]: [number, number]): number {
  return Math.max(lo, Math.min(hi, v))
}
