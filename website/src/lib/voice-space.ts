import type { VoiceSpaceData, VoiceSpaceLetter } from '@/data/lab-types'

/**
 * Geometry for the Lab's voice space: 31 letters placed in a cube and
 * projected to a 2D stage.
 *
 * Pure functions only — no React, no DOM, no Date, no randomness. The same
 * call runs on the server to render the resting frame (so a visitor without
 * JavaScript still sees the plot) and on the client after every drag, and the
 * two must agree byte-for-byte or React reports a hydration mismatch. That
 * is also why every emitted coordinate is rounded to a tenth of a pixel:
 * V8 and JavaScriptCore can differ in the last bit of `sin` and `cos`, and
 * the rounding makes the difference unobservable.
 *
 * WHAT GOES WHERE
 *   left → right   sweep slope, on a domain symmetric about zero, so the
 *                  centre of the floor is "flat" and the label "falling ←
 *                  → rising" is literally true
 *   bottom → top   pitch, on exactly [base − step, base + n·step], so the
 *                  alphabet climbs the vertical axis as a straight spine
 *   front → back   duration
 *   colour         brightness, species base colour → ochre
 *   size           sweep span
 *
 * The projection is orthographic. Perspective would draw near points larger,
 * and size already means something here.
 */

export const ALPHABET = "abcdefghijklmnopqrstuvwxyz .,'?"

export interface ViewAngles {
  /** Rotation about the vertical axis, radians. */
  yaw: number
  /** Tilt down from the horizon, radians. Clamped so the floor stays a floor. */
  elevation: number
}

/**
 * The resting view is ISOMETRIC: yaw −45° and a tilt of atan(1/√2) ≈ 35.26°,
 * the one camera position at an equal angle to all three axes. It is what
 * makes the three arrows the same length on screen (each foreshortened by
 * the same √(2/3)) and evenly spread at 120° — up, down-left, down-right,
 * the picture people recognise as "a 3D axis triad".
 *
 * The sign of the yaw is the whole difference between a triad and a fan. At
 * +45° both horizontal axes project to the right of vertical (arrows at 90°,
 * 30° and −30°, so 60°/60°/240° apart) and the cloud crowds one corner; at
 * −45° they fall either side of it, the cube's long diagonal points at the
 * viewer, and the shared origin lands exactly at the centre of the stage.
 */
export const DEFAULT_VIEW: ViewAngles = { yaw: -Math.PI / 4, elevation: Math.atan(1 / Math.SQRT2) }

/**
 * Elevation runs the whole quarter turn, 0 to 90°.
 *
 * 0° is edge-on to the floor — pitch straight up the screen, the other two
 * axes flat — and 90° is straight down onto the floor, with pitch pointing at
 * the viewer and gone. Both ends are useful rather than degenerate: at each
 * one an axis collapses and the plot becomes the honest 2D scatter of the
 * other two, which is how you SEE that the three attributes barely predict
 * one another. An axis whose projection has collapsed is faded out by the
 * stage rather than drawn as a stub.
 */
export const ELEVATION_RANGE: [number, number] = [0, Math.PI / 2]
export const STAGE = { width: 780, height: 500 } as const

export type AxisKey = 'slope' | 'pitch' | 'duration'

/**
 * The three views that look straight down one axis. Each flattens its own
 * axis and lays the other two out square, so `slope` shows duration against
 * pitch, and so on.
 */
export const AXIS_VIEWS: Record<AxisKey, ViewAngles> = {
  slope: { yaw: Math.PI / 2, elevation: 0 },
  duration: { yaw: 0, elevation: 0 },
  // Yaw is free at 90° elevation — pitch points at the viewer whatever the
  // yaw is — but it still decides how the OTHER two lie. A quarter turn puts
  // them square, slope up and duration right, so all three locked views read
  // the same way: two perpendicular axes, both increasing up and right.
  // Keeping the resting −45° here would have left this one view on the
  // diagonal while its two siblings were square.
  pitch: { yaw: Math.PI / 2, elevation: Math.PI / 2 },
}

const TAU = Math.PI * 2

/** The turn of `to` nearest `from`, so a glide never spins the long way. */
export function nearestYaw(from: number, to: number): number {
  return to + Math.round((from - to) / TAU) * TAU
}

/**
 * Which axis, if any, currently points at the viewer.
 *
 * Read off the projection itself rather than by comparing against
 * AXIS_VIEWS: an axis collapses for a whole family of angles (yaw ±90° both
 * flatten slope), and a dragged view that lands on one should light the
 * matching button just as a clicked one does.
 */
export function collapsedAxis(v: ViewAngles, eps = 0.03): AxisKey | null {
  if (Math.abs(Math.cos(v.elevation)) < eps) return 'pitch'
  if (Math.abs(Math.sin(v.elevation)) < eps) {
    if (Math.abs(Math.cos(v.yaw)) < eps) return 'slope'
    if (Math.abs(Math.sin(v.yaw)) < eps) return 'duration'
  }
  return null
}

/** Same camera position, allowing for yaw wrapping a whole turn. */
export function sameView(a: ViewAngles, b: ViewAngles, eps = 0.01): boolean {
  const d = Math.abs((((a.yaw - b.yaw) % TAU) + TAU + Math.PI) % TAU - Math.PI)
  return d < eps && Math.abs(a.elevation - b.elevation) < eps
}

/**
 * Side lengths of the box the points live in, in scale units. A cube, on
 * purpose: the axes are drawn as arrows and equal arrows are the point of
 * the isometric view above. (An earlier build stretched the slope axis to
 * fill a landscape stage; that bought width at the price of three visibly
 * unequal arrows, which reads as "these axes are not comparable".)
 */
const BOX = { u: 1, v: 1, w: 1 }

/**
 * The drawing sits a little below the middle of the stage.
 *
 * An isometric triad is top-heavy: the vertical arrow reaches its full
 * length upward while the other two fall only sin(30°) — half as far — and
 * the pitch name sits above the top arrow on top of that. Projecting about
 * the exact centre measured 15 px of margin above the drawing and 118 below.
 * This offset splits that evenly, and still leaves every locked view inside
 * the viewBox.
 */
const CENTRE_Y = STAGE.height / 2 + 45

/** Accent used for the bright end of the colour ramp — the site's ochre token. */
const OCHRE = '#B8791B'

export interface StagePoint {
  i: number
  ch: string
  x: number
  y: number
  /** Where the drop-line meets the floor. */
  floorX: number
  floorY: number
  /** 0 = nearest the viewer, 1 = farthest. */
  depth: number
  r: number
  fill: string
}

export interface AxisTick {
  x: number
  y: number
  text: string
  anchor: 'start' | 'middle' | 'end'
}

export interface AxisLine {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Name anchor, past the arrow tip. */
  lx: number
  ly: number
  anchor: AxisTick['anchor']
  /** Projected length in px — near zero when the axis points at the viewer. */
  len: number
  lo: AxisTick
  hi: AxisTick
}

export interface StageLayout {
  /** Alphabet order; `points[i]` is `ALPHABET[i]`. */
  points: StagePoint[]
  /** Indices back-to-front, for painter's order. */
  order: number[]
  axes: { slope: AxisLine; duration: AxisLine; pitch: AxisLine }
  /** The slope = 0 line across the floor. */
  zeroTick: { x1: number; y1: number; x2: number; y2: number }
}

const r1 = (v: number) => Math.round(v * 10) / 10

function project(u: number, v: number, w: number, view: ViewAngles) {
  const cx = (u - 0.5) * BOX.u
  const cy = (v - 0.5) * BOX.v
  const cz = (w - 0.5) * BOX.w
  const cosY = Math.cos(view.yaw)
  const sinY = Math.sin(view.yaw)
  const x1 = cx * cosY + cz * sinY
  const z1 = -cx * sinY + cz * cosY
  const cosE = Math.cos(view.elevation)
  const sinE = Math.sin(view.elevation)
  const y2 = cy * cosE - z1 * sinE
  const depth = cy * sinE + z1 * cosE
  // The axis names sit BEYOND the arrow tips, so the margin they need is the
  // binding constraint, not the cube: the resting view is the tallest of all
  // (a corner reaches 0.82 × scale above and below the centre, more than the
  // 0.71 of the top-down view), then 34 px of offset and two lines of text
  // past that. 0.42 × 500 keeps the farthest of those inside the viewBox at
  // every rotation the drag and the axis buttons can reach — the tightest is
  // the bottom of the pitch-locked view, with ~12 px to spare.
  const scale = 0.42 * Math.min(STAGE.width, STAGE.height)
  return {
    x: STAGE.width / 2 + x1 * scale,
    y: CENTRE_Y - y2 * scale,
    depth,
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Linear mix of two hex colours; channels are rounded to integers so the
 *  string is identical on every runtime. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const k = Math.max(0, Math.min(1, t))
  const c = (x: number, y: number) =>
    Math.round(x + (y - x) * k)
      .toString(16)
      .padStart(2, '0')
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`
}

export function letterIndex(ch: string): number {
  return ALPHABET.indexOf(ch)
}

/** Which cue is sounding at `t`, or −1 between notes. Gaps are real: the
 *  trained voices leave articulation silence between letters, and a word
 *  pause between words, so −1 is a state worth showing, not an error. */
export function activeCueIndex(
  cues: { t0: number; t1: number }[],
  t: number,
): number {
  if (t <= 0) return -1
  return cues.findIndex((c) => t >= c.t0 && t < c.t1)
}

/** How many cues have started by `t`. The same rule SubtitleTrack uses, so
 *  the trail and the subtitle agree. */
export function sungCount(cues: { t0: number }[], t: number): number {
  if (t <= 0) return 0
  let n = 0
  for (const c of cues) {
    if (c.t0 < t) n++
    else break
  }
  return n
}

/** Shared pitch range across every letter's contour, so sparklines are
 *  comparable letter to letter rather than each stretched to fill. */
export function contourDomain(letters: VoiceSpaceLetter[]): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (const l of letters) {
    for (const v of l.f0) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  return [lo, hi]
}

export function layoutVoiceSpace(
  data: VoiceSpaceData,
  view: ViewAngles,
  palette: { base: string },
): StageLayout {
  const { letters, meta } = data

  const slopeMax = Math.max(...letters.map((l) => Math.abs(l.slope)))
  const pitchLo = meta.base - meta.step
  const pitchHi = meta.base + meta.nLetters * meta.step
  const durs = letters.map((l) => l.dur)
  const durMin = Math.min(...durs)
  const durMax = Math.max(...durs)
  const durPad = (durMax - durMin) * 0.05
  const durLo = durMin - durPad
  const durHi = durMax + durPad
  const brights = letters.map((l) => l.bright)
  const bLo = Math.min(...brights)
  const bHi = Math.max(...brights)
  const spans = letters.map((l) => l.span)
  const sLo = Math.min(...spans)
  const sHi = Math.max(...spans)

  const u = (slope: number) => (slope + slopeMax) / (2 * slopeMax)
  const v = (pitch: number) => (pitch - pitchLo) / (pitchHi - pitchLo)
  const w = (dur: number) => (dur - durLo) / (durHi - durLo)

  const depths: number[] = []
  const points: StagePoint[] = letters.map((l, i) => {
    const p = project(u(l.slope), v(l.pitch), w(l.dur), view)
    const f = project(u(l.slope), 0, w(l.dur), view)
    depths.push(p.depth)
    return {
      i,
      ch: l.ch,
      x: r1(p.x),
      y: r1(p.y),
      floorX: r1(f.x),
      floorY: r1(f.y),
      depth: p.depth,
      r: r1(3.5 + 5.5 * ((l.span - sLo) / (sHi - sLo || 1))),
      fill: mixHex(palette.base, OCHRE, (l.bright - bLo) / (bHi - bLo || 1)),
    }
  })
  const dLo = Math.min(...depths)
  const dHi = Math.max(...depths)
  for (const p of points) p.depth = r1((p.depth - dLo) / (dHi - dLo || 1) * 10) / 10
  const order = points
    .map((p, i) => [p.depth, i] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i)

  type V3 = [number, number, number]
  const axis = (a: V3, b: V3, out: V3, loText: string, hiText: string): AxisLine => {
    const p = project(a[0], a[1], a[2], view)
    const q = project(b[0], b[1], b[2], view)
    // Label side is decided in 3D, not on screen: `out` points away from the
    // box along the two axes this one is NOT (for the slope edge, down and
    // toward the front). Projected, that is always the side with no points
    // on it, whichever way the view is turned — a screen-space "away from
    // centre" rule is ambiguous exactly in the isometric resting view, where
    // the front edges are symmetric about the centre.
    const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    const mp = project(m[0], m[1], m[2], view)
    const mo = project(m[0] + out[0] * 0.2, m[1] + out[1] * 0.2, m[2] + out[2] * 0.2, view)
    // Offset along the screen PERPENDICULAR of the axis — the projected 3D
    // "out" direction only picks which side, because on screen it can run
    // mostly along the axis (it does for the front edges in the isometric
    // view), and an offset along the axis moves the label, not off it.
    const dx = q.x - p.x
    const dy = q.y - p.y
    const len = Math.hypot(dx, dy)
    const dl = len || 1
    let nx = -dy / dl
    let ny = dx / dl
    if (nx * (mo.x - mp.x) + ny * (mo.y - mp.y) < 0) {
      nx = -nx
      ny = -ny
    }
    const tickAnchor: AxisTick['anchor'] = nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle'
    // Ticks sit a little way in from each end, so the three low ends do not
    // pile onto the shared origin and the high ends clear the arrowheads.
    const tick = (t: number, text: string): AxisTick => ({
      x: r1(p.x + dx * t + nx * 12),
      y: r1(p.y + dy * t + ny * 12),
      text,
      anchor: tickAnchor,
    })

    // The NAME goes past the arrow tip, upright.
    //
    // Beyond the tip is the one place that is outside the point cloud at
    // every rotation — hugging the axis put it through the middle of the
    // letters whenever the cloud leaned that way. Upright rather than rotated
    // with the arrow, because out here it no longer has to trace anything,
    // and level text is easier to read than text rolled onto a diagonal.
    const ux = len > 1e-6 ? dx / len : 0
    const uy = len > 1e-6 ? dy / len : -1
    // The name is two lines stacked downward; when it sits above its tip,
    // lift it a line so the unit does not fall back onto the arrowhead.
    const lift = uy < -0.2 ? 13 : 0
    return {
      x1: r1(p.x),
      y1: r1(p.y),
      x2: r1(q.x),
      y2: r1(q.y),
      lx: r1(q.x + ux * 34),
      ly: r1(q.y + uy * 34 - lift),
      anchor: ux > 0.25 ? 'start' : ux < -0.25 ? 'end' : 'middle',
      len: r1(len),
      lo: tick(0.12, loText),
      hi: tick(0.88, hiText),
    }
  }

  const z0 = u(0)
  const zp = project(z0, 0, 0, view)
  const zq = project(z0, 0, 1, view)

  return {
    points,
    order,
    axes: {
      // The slope edge's "out" is straight down (under the floor). Down-and-
      // front would be the corner's true outward direction, but in the
      // isometric resting view that projects exactly along this axis and
      // leaves the side choice to rounding.
      slope: axis(
        [0, 0, 0],
        [1, 0, 0],
        [0, -1, 0],
        `−${Math.round(slopeMax / 1000)}k`,
        `+${Math.round(slopeMax / 1000)}k`,
      ),
      pitch: axis([0, 0, 0], [0, 1, 0], [-1, 0, -1], `${pitchLo}`, `${pitchHi}`),
      duration: axis(
        [0, 0, 0],
        [0, 0, 1],
        [-1, -1, 0],
        `${Math.round(durLo)}`,
        `${Math.round(durHi)}`,
      ),
    },
    zeroTick: { x1: r1(zp.x), y1: r1(zp.y), x2: r1(zq.x), y2: r1(zq.y) },
  }
}
