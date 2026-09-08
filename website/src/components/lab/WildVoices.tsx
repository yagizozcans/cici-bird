'use client'

import { AudioPlayer } from '@/components/AudioPlayer'
import type { WildVoicesData, WildClip } from '@/data/lab-types'
import type { Dictionary } from '@/i18n/dictionary'

/**
 * Five field recordings of the real bird, and what our decoder reads out of
 * each one.
 *
 * The point of the section is a negative result, so it has to be legible as
 * one. The decoder is closed-set — it always returns its best explanation —
 * so wild song comes back as confident-looking letters, and a visitor who
 * sees only the letters would reasonably conclude we are translating birds.
 * Every clip therefore shows the reading and the score TOGETHER, on the same
 * scale as the same decoder's score for the voice's own encoded message. The
 * gap between the two marks is the whole finding.
 *
 * Nothing here is written: the text, the score, the recordist and the licence
 * all come from `src/data/lab/*-wild-voices.json`, which one script writes by
 * decoding the very m4a this component plays.
 *
 * Client, only because each row owns an audio element. The rows are otherwise
 * static — no state lives in this file.
 */

type Copy = Dictionary['lab']['wildVoices']

export function WildVoices({
  data,
  copy,
  accent,
  playLabel,
  pauseLabel,
}: {
  data: WildVoicesData
  copy: Copy
  accent: string
  playLabel: string
  pauseLabel: string
}) {
  const { meta, clips } = data
  return (
    <ul className="mt-8 grid gap-4">
      {clips.map((clip, i) => (
        <ClipRow
          key={clip.id}
          clip={clip}
          n={i + 1}
          meta={meta}
          copy={copy}
          accent={accent}
          playLabel={playLabel}
          pauseLabel={pauseLabel}
        />
      ))}
    </ul>
  )
}

function ClipRow({
  clip,
  n,
  meta,
  copy,
  accent,
  playLabel,
  pauseLabel,
}: {
  clip: WildClip
  n: number
  meta: WildVoicesData['meta']
  copy: Copy
  accent: string
  playLabel: string
  pauseLabel: string
}) {
  const d = clip.decoded
  return (
    <li className="rounded-xl2 border border-line bg-white/60 p-5 sm:p-6">
      <AudioPlayer
        audio={{
          id: clip.id,
          src: clip.src,
          mime: clip.mime,
          durationSec: clip.durationSec,
          text: null,
          cues: [],
          wordCues: [],
          decodeAccuracy: null,
          synthesis: null,
        }}
        label={`${copy.clipLabel} ${n} · ${clip.sourceId}`}
        variant="bar"
        accentColor={accent}
        playLabel={playLabel}
        pauseLabel={pauseLabel}
      />

      {/* The reading. Monospace and quoted because it is a machine's output,
          not a sentence — and spaces are letters here too, so an empty-looking
          run is information. */}
      <div className="mt-5 rounded-lg border border-line bg-paper/70 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {copy.readsAs}
        </p>
        <p className="mt-1.5 break-all font-mono text-[15px] leading-relaxed text-ink">
          {d.text ? `“${d.text}”` : copy.readsNothing}
        </p>
      </div>

      <Scale meta={meta} score={d.score} copy={copy} accent={accent} />

      <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-muted">
        <span className="text-ink/80">{clip.recordist}</span>
        <span aria-hidden="true">·</span>
        <a
          href={clip.sourceUrl}
          rel="noopener nofollow"
          className="underline underline-offset-2 hover:text-ink"
        >
          {clip.sourceId}
        </a>
        <span aria-hidden="true">·</span>
        <a
          href={clip.licenseUrl}
          rel="noopener nofollow"
          className="underline underline-offset-2 hover:text-ink"
        >
          {clip.license}
        </a>
        <span aria-hidden="true">·</span>
        <span>{clip.location}</span>
      </p>
    </li>
  )
}

/**
 * Where this clip's score sits between zero and the same decoder's score for
 * the voice's own message, with the threshold marked.
 *
 * A bare number ("0.0055") means nothing to a reader; the same number an inch
 * to the left of the line it would have to cross means everything. The scale
 * runs to `messageScore` rather than to 1.0 because the score is a per-column
 * Viterbi score with no natural ceiling — the message's own score is the only
 * honest "this is what a yes looks like".
 */
function Scale({
  meta,
  score,
  copy,
  accent,
}: {
  meta: WildVoicesData['meta']
  score: number
  copy: Copy
  accent: string
}) {
  const top = meta.messageScore
  const pct = (v: number) => `${Math.max(0, Math.min(v / top, 1)) * 100}%`
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-3 text-[11px] text-muted">
        <span className="font-semibold uppercase tracking-[0.1em]">{copy.scoreLabel}</span>
        <span className="font-mono tabular-nums text-ink">{score.toFixed(4)}</span>
      </div>

      <div className="relative mt-2 h-2 rounded-full bg-line/70">
        {/* Everything at or past the threshold would be believed. */}
        <div
          className="absolute inset-y-0 rounded-r-full bg-ink/10"
          style={{ left: pct(meta.threshold), right: 0 }}
        />
        <div
          className="absolute inset-y-[-4px] w-px bg-ink/50"
          style={{ left: pct(meta.threshold) }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper"
          style={{ left: pct(score), backgroundColor: accent }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>
          {copy.thresholdLabel}{' '}
          <span className="font-mono tabular-nums">{meta.threshold.toFixed(4)}</span>
        </span>
        <span>
          {copy.messageScoreLabel}{' '}
          <span className="font-mono tabular-nums">{top.toFixed(4)}</span>
        </span>
      </div>

      <p className="mt-2 text-[12px] text-muted">{copy.verdict}</p>
    </div>
  )
}
