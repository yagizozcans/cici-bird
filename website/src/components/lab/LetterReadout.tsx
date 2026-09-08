import type { VoiceSpaceLetter } from '@/data/lab-types'
import type { Dictionary } from '@/i18n/dictionary'

/**
 * The panel beside the plot: one letter, its real note, its numbers.
 *
 * The sparkline is the motif itself — the pitch contour of the note this
 * letter borrowed, as the model sings it — with the loudness envelope filled
 * underneath. Its vertical range is SHARED across all 31 letters, so a note
 * that sweeps 6 kHz looks six times taller than one that sweeps 1 kHz; each
 * letter stretched to fill the box would make every note look the same.
 *
 * `state` is the one thing the visitor needs to know about the panel: whether
 * it shows what is being sung right now, what they picked, or what was sung
 * last during a gap between notes.
 */

export type ReadoutState = 'idle' | 'singing' | 'selected' | 'silence'
export type ReadoutCopy = Dictionary['lab']['voiceSpace']['readout']

interface Props {
  letter: VoiceSpaceLetter | null
  state: ReadoutState
  libNotes: number
  /** Shared pitch range across all letters' contours, Hz. */
  f0Domain: [number, number]
  accent: string
  copy: ReadoutCopy
  /** A note to show under the numbers, e.g. "not in this message". */
  note?: string | null
}

const W = 160
const H = 48
const PAD = 4
const r1 = (v: number) => Math.round(v * 10) / 10

export function LetterReadout({
  letter,
  state,
  libNotes,
  f0Domain,
  accent,
  copy,
  note,
}: Props) {
  return (
    <div className="rounded-xl2 border border-line bg-white/60 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {copy[state]}
      </p>

      {letter ? (
        <>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-[40px] font-semibold leading-none text-ink">
              {letter.ch === ' ' ? '␣' : letter.ch}
            </span>
            <span className="font-mono text-[11px] text-muted">
              {copy.motif} #{letter.idx} {copy.of} {libNotes}
            </span>
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            {copy.contour}
          </p>
          <Sparkline letter={letter} domain={f0Domain} accent={accent} />
          <div className="flex justify-between font-mono text-[10px] text-muted">
            <span>{Math.round(f0Domain[0])} Hz</span>
            <span>{Math.round(f0Domain[1])} Hz</span>
          </div>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[12px] tabular-nums">
            <Row label={copy.pitch}>{Math.round(letter.pitch)} Hz</Row>
            <Row label={copy.duration}>{Math.round(letter.dur)} ms</Row>
            <Row label={copy.slope}>
              {letter.slope > 0 ? '+' : letter.slope < 0 ? '−' : ''}
              {Math.abs(Math.round(letter.slope)).toLocaleString('en')} Hz/s
            </Row>
            <Row label={copy.span}>{Math.round(letter.span)} Hz</Row>
            <Row label={copy.brightness}>{Math.round(letter.bright)} Hz</Row>
            <Row label={copy.breathiness}>{Math.round(letter.flat * 100)}%</Row>
            <Row label={copy.transplant}>{Math.round(letter.transplant)} Hz</Row>
          </dl>

          {note && <p className="mt-3 text-[12px] text-muted">{note}</p>}
        </>
      ) : (
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{copy.empty}</p>
      )}
    </div>
  )
}

function Sparkline({
  letter,
  domain,
  accent,
}: {
  letter: VoiceSpaceLetter
  domain: [number, number]
  accent: string
}) {
  const [lo, hi] = domain
  const n = letter.f0.length
  const x = (i: number) => r1(PAD + (i / (n - 1)) * (W - PAD * 2))
  const yF0 = (v: number) => r1(H - PAD - ((v - lo) / (hi - lo || 1)) * (H - PAD * 2))
  const yEnv = (v: number) => r1(H - PAD - v * (H - PAD * 2))

  const contour = letter.f0.map((v, i) => `${x(i)},${yF0(v)}`).join(' ')
  const envelope =
    `${x(0)},${H - PAD} ` +
    letter.env.map((v, i) => `${x(i)},${yEnv(v)}`).join(' ') +
    ` ${x(n - 1)},${H - PAD}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-12 w-full" aria-hidden="true">
      <polygon points={envelope} fill={accent} fillOpacity="0.22" />
      <polyline
        points={contour}
        fill="none"
        stroke="#16150F"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </>
  )
}
