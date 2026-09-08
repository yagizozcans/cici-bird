import { getDictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'
import type { AudioAsset, TrainedVoice } from '@/data/audio-manifest'

/**
 * The trained-model panel, shown only for species that actually have one.
 *
 * Two species have one: the Bewick's wren (`ml/checkpoints/wren.pt`, fitted to
 * 222 real recordings) and the song sparrow (`ml/checkpoints/sparrow_win256.pt`,
 * 250 clips from 114 recordings). Both sequence messages from note motifs
 * borrowed out of those same recordings and are read back by a Viterbi search
 * instead of an FFT.
 *
 * It earns a panel rather than a footnote because the difference is audible —
 * these voices sing unequal, real-length notes with natural pacing where the
 * parametric voices tick along a fixed grid — and because the accuracy figure
 * beside it is a real measurement rather than arithmetic about a grid. The
 * wren's clip decodes at ~96%, not 100%, and publishing that next to the
 * others is the honest version.
 *
 * Every figure is read from the audio manifest, written by the asset build. If
 * the model is retrained, this panel changes on its own.
 */
export function TrainedVoicePanel({
  voice,
  encoded,
  locale,
  accent,
}: {
  voice: TrainedVoice
  encoded: AudioAsset
  locale: Locale
  accent: string
}) {
  const dict = getDictionary(locale)
  const m = dict.species.model
  const check = voice.identification

  return (
    <section className="wrap pb-4">
      <div
        className="rounded-xl2 border bg-white/60 p-5 sm:p-6"
        style={{ borderColor: `${accent}55` }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink"
            style={{ backgroundColor: `${accent}2E`, boxShadow: `inset 0 0 0 1px ${accent}70` }}
          >
            {m.badge}
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-ink">
            {m.title}
          </h2>
        </div>

        <p className="mt-3 max-w-measure text-[14px] leading-relaxed text-muted">
          {m.body}
        </p>

        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
          <Field label={m.modelLabel}>
            <code className="font-mono text-[12.5px] text-ink">{voice.model}</code>
          </Field>
          <Field label={m.corpusLabel}>
            {voice.corpusSize} {m.corpusUnit}
            <span className="mt-0.5 block font-mono text-[11.5px] text-muted">
              {voice.corpus}
            </span>
          </Field>
          <Field label={m.decoderLabel}>
            {encoded.synthesis?.decoder ?? '—'}
          </Field>
        </dl>

        {typeof encoded.decodeAccuracy === 'number' && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-[14px] text-ink">
              <span className="font-semibold">
                {m.accuracyLabel} {Math.round(encoded.decodeAccuracy * 100)}%
              </span>
            </p>
            <p className="mt-1.5 max-w-measure text-[13px] leading-relaxed text-muted">
              {m.accuracyBody}
            </p>
            {/* Only claim it reads back imperfectly when it measurably does.
                This clip happens to decode at 96%, but the demo sentence on the
                landing page hits 100% — copy that asserts one or the other
                would be wrong half the time. */}
            {encoded.decodeAccuracy < 1 && (
              <p className="mt-2 max-w-measure text-[13px] leading-relaxed text-muted">
                {m.accuracyImperfect}
              </p>
            )}
            {encoded.text && encoded.decodedText && encoded.decodedText !== encoded.text && (
              // Showing the actual misreading is the point. "96%" is abstract;
              // seeing WHICH letter the decoder dropped is what tells a reader
              // whether the number matters to them — so the differing
              // characters are marked individually rather than the whole line
              // being tinted. Marked with a background rather than a coloured
              // foreground: species accents are decorative-weight colours and
              // none of the eight reaches 4.5:1 as text on this panel.
              <p className="mt-3 whitespace-pre font-mono text-[12.5px] leading-relaxed text-ink">
                <span className="text-muted">sent{'\u00a0'.repeat(4)}</span>
                {encoded.text}
                <br />
                <span className="text-muted">decoded{'\u00a0'}</span>
                {misreadMask(encoded.text, encoded.decodedText).map((wrong, i) =>
                  wrong ? (
                    <mark
                      key={i}
                      className="bg-transparent text-ink"
                      style={{
                        backgroundColor: `${accent}66`,
                        boxShadow: `inset 0 0 0 1px ${accent}`,
                      }}
                    >
                      {encoded.decodedText![i]}
                    </mark>
                  ) : (
                    encoded.decodedText![i]
                  ),
                )}
              </p>
            )}
          </div>
        )}

        {check && (
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-[14px] font-semibold tracking-tight text-ink">
              {m.forkTitle}
            </h3>
            <p className="mt-1.5 max-w-measure text-[13px] leading-relaxed text-muted">
              {m.forkBody}
            </p>

            <ul className="mt-4 space-y-2">
              <ScoreRow
                label={m.forkMessage}
                value={check.messageScore}
                threshold={check.threshold}
                accent={accent}
              />
              <ScoreRow
                label={m.forkWild}
                value={check.wildScore}
                threshold={check.threshold}
                accent={accent}
              />
            </ul>

            <p className="mt-3 text-[12px] text-muted">
              {m.forkThreshold}: <span className="font-mono">{check.threshold}</span>
              {check.separated && <> · {m.forkPassed}</>}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Which characters of `decoded` the decoder got wrong.
 *
 * A longest-common-subsequence alignment, so an inserted or dropped character
 * marks only itself rather than shifting everything after it into a false
 * mismatch. The strings are one short sentence, so the quadratic table is a
 * few thousand cells.
 */
function misreadMask(sent: string, decoded: string): boolean[] {
  const n = sent.length
  const m = decoded.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        sent[i] === decoded[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const mask = new Array<boolean>(m).fill(true)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (sent[i] === decoded[j]) {
      mask[j] = false
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return mask
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] leading-relaxed text-ink/85">{children}</dd>
    </div>
  )
}

/**
 * One score against the threshold.
 *
 * The bar is scaled so the threshold sits at a fixed 50% of the track,
 * which is what makes "comfortably over" and "nowhere near" legible at a
 * glance — a linear scale from zero would squash both scores into the left
 * third and show nothing.
 */
function ScoreRow({
  label,
  value,
  threshold,
  accent,
}: {
  label: string
  value: number
  threshold: number
  accent: string
}) {
  const over = value >= threshold
  const pct = Math.max(2, Math.min(100, (value / (threshold * 2)) * 100))

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="min-w-[16ch] flex-1 text-[13px] text-ink/85">{label}</span>
      <span className="relative h-1.5 w-full max-w-[180px] rounded-full bg-line">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: over ? accent : '#9A968B' }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-[-3px] w-px bg-ink/40"
          style={{ left: '50%' }}
        />
      </span>
      <span className="w-[7ch] shrink-0 text-right font-mono text-[12px] tabular-nums text-ink">
        {value >= 0 ? '+' : ''}
        {value.toFixed(4)}
      </span>
    </li>
  )
}
