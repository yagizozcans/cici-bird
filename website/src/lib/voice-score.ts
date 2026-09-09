import type { VoiceSpaceData } from '@/data/lab-types'
import { contourDomain, letterIndex } from './voice-space'

/**
 * The encoded message drawn as a score: every note a trained voice sings,
 * placed at the time it is sung and the pitch it is sung at.
 *
 * This replaces the parametric voice signature (lib/artwork.ts) on the pages
 * of the three species that have a model behind them. The signature draws ONE
 * invented note from a hand-authored synthesis profile and repeats it across
 * the width; a trained voice has no such profile, and repeating a note it
 * never sang twice is a picture of nothing. Everything here is measured:
 *
 *   x  the cue spans the audio build wrote while the model sang — real,
 *      unequal note lengths, and real silence between them
 *   y  the note's pitch contour, `letters[i].f0`, the same 32 samples the
 *      Lab's sparkline draws
 *   thickness  its loudness envelope, `letters[i].env`
 *
 * So the mark is the clip. When the visitor presses play, the playhead is
 * over the note making the sound.
 *
 * PURE, and computed on the SERVER. Nothing here depends on the playhead —
 * only which note is lit does — so the geometry ships as ~25 subpaths of
 * flat data rather than 31 letters' worth of contours plus the code to
 * project them. That is also why `env` is resampled to 16 points here: it is
 * the one array the browser still needs (the glow breathes with the note's
 * real loudness), and at 25 px per note the other 16 samples are invisible.
 */

/**
 * The score is drawn at a FIXED TIME SCALE and scrolls, rather than fitting a
 * whole message into whatever box it is given.
 *
 * Fitting is what the first version did, and it made the mark unreadable. In a
 * 300 px column a 4.5 s clip gives a 130 ms note about 14 screen px, while the
 * pitch it sweeps inside that note is ~50 px tall — so every note drew as a
 * near-vertical scratch and the shape of the song was invisible. At 380 px per
 * second the same note is ~49 px wide against ~84 px of sweep: still steep,
 * because a wren's f0 genuinely leaps, but now a contour rather than a spike.
 *
 * One unit is one CSS pixel here — the SVG carries explicit width and height
 * and is not scaled — so these numbers mean what they say on screen.
 */
export const SCORE_HEIGHT = 260
const PX_PER_SECOND = 380

const PAD_X = 8
const PAD_Y = 16
/** Samples kept per note. A note is ~35–95 px wide here; 16 is ~3 px apart. */
const SAMPLES = 16
/** Half-thickness of the ribbon at silence and at full loudness, px. */
const HALF_MIN = 1.1
const HALF_MAX = 8

export interface ScoreNote {
  ch: string
  /** Sung span, seconds, straight off the cue. */
  t0: number
  t1: number
  /** The ribbon: pitch contour thickened by loudness. */
  body: string
  /** Loudest point of the note, where the glow sits while it sounds. */
  px: number
  py: number
  /** Loudness at `SAMPLES` points across the note, 0..1. */
  env: number[]
}

export interface VoiceScore {
  notes: ScoreNote[]
  /** Drawn width, px. Wider than any column it sits in — the box scrolls. */
  width: number
  /** Whole-kHz rules across the pitch range, as one path. */
  lanes: string
  /** Pitch range the rules and the contours share, Hz. */
  domain: [number, number]
  /** Seconds the width spans — the clip, not the last note. */
  duration: number
}

const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * Where a moment in the clip falls across the mark, in px from its left edge.
 *
 * Callers round the result to a whole pixel. The samples inside a note are
 * ~3 px apart, so a tenth of a pixel is invisible and costs a character in
 * every coordinate — of which one page has about 1,300, twice over (the
 * markup, and the escaped copy of it in the RSC payload). Y keeps its decimal:
 * the ribbon is only 2.2 px thick at a note's quietest, and rounding both
 * edges to the same integer would erase it.
 */
export function scoreX(t: number): number {
  return PAD_X + Math.max(0, t) * PX_PER_SECOND
}

export function layoutVoiceScore(
  data: VoiceSpaceData,
  cues: { t0: number; t1: number; text: string }[],
  durationSec: number,
): VoiceScore {
  const domain = contourDomain(data.letters)
  const [lo, hi] = domain
  // A clip runs a little past its last note; using the manifest duration
  // keeps the playhead and the seek bar underneath on the same clock.
  const duration = durationSec || (cues.length ? cues[cues.length - 1].t1 : 1)

  const width = Math.round(PAD_X * 2 + duration * PX_PER_SECOND)

  const y = (hz: number) =>
    SCORE_HEIGHT - PAD_Y - ((hz - lo) / (hi - lo || 1)) * (SCORE_HEIGHT - PAD_Y * 2)

  const notes: ScoreNote[] = []
  for (const cue of cues) {
    // A space has a cue so the subtitle can time the word pause, but the
    // voice rests through it — it sings no motif, so the score shows the
    // gap. Same rule the Lab's plot uses.
    const idx = letterIndex(cue.text)
    if (idx < 0 || cue.text === ' ') continue
    const letter = data.letters[idx]
    if (!letter) continue

    const n = letter.f0.length
    // Even samples across the note, with the last one always kept so the
    // ribbon ends where the note ends.
    const at: number[] = []
    for (let s = 0; s < SAMPLES; s++) at.push(Math.round((s * (n - 1)) / (SAMPLES - 1)))

    const top: string[] = []
    const bottom: string[] = []
    let pi = at[0]
    for (const i of at) {
      const u = i / (n - 1)
      const px = Math.round(scoreX(cue.t0 + u * (cue.t1 - cue.t0)))
      const py = y(letter.f0[i])
      const half = HALF_MIN + letter.env[i] * (HALF_MAX - HALF_MIN)
      top.push(`${px},${r1(py - half)}`)
      bottom.unshift(`${px},${r1(py + half)}`)
      if (letter.env[i] > letter.env[pi]) pi = i
    }

    notes.push({
      ch: cue.text,
      t0: cue.t0,
      t1: cue.t1,
      body: `M${top.join('L')}L${bottom.join('L')}Z`,
      px: Math.round(scoreX(cue.t0 + (pi / (n - 1)) * (cue.t1 - cue.t0))),
      py: r1(y(letter.f0[pi])),
      env: at.map((i) => Math.round(letter.env[i] * 100) / 100),
    })
  }

  // Whole-kHz rules. A real frequency ruler rather than evenly spaced
  // decoration: the gap between two rules is 1 kHz on every bird's page, so
  // the cardinal's low, wide song and the wren's high one are comparable
  // marks rather than two pictures scaled to fill their own boxes.
  const rules: string[] = []
  for (let hz = Math.ceil(lo / 1000) * 1000; hz <= hi; hz += 1000) {
    rules.push(`M0,${Math.round(y(hz))}H${width}`)
  }

  return { notes, width, lanes: rules.join(''), domain, duration }
}
