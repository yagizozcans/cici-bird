import type { AudioAsset } from '@/data/audio-manifest'
import { getDictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'

/**
 * One asset's attribution block.
 *
 * website.md §5: "audio credits and licensing attributions rendered from asset
 * metadata, not hand-maintained." Every field below comes from the manifest
 * written by scripts/generate_audio.py; nothing is typed in here.
 *
 * The important branch is `verified`. When provenance is still unconfirmed the
 * component renders what we actually know — source, identifier, and the
 * outstanding action — instead of a confident credit line. An attribution we
 * cannot stand behind is worse than a visible gap, because the gap is what
 * gets fixed before launch and the confident line is what gets shipped and
 * forgotten.
 */
export function AssetCredit({
  asset,
  locale,
}: {
  asset: AudioAsset
  locale: Locale
}) {
  const dict = getDictionary(locale)
  const c = asset.credit
  const kindLabel =
    c.kind === 'real-call'
      ? dict.species.fieldRecording
      : c.kind === 'synth-reference'
        ? dict.species.synthesized
        : c.title

  return (
    <div className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] font-medium text-ink">{c.title}</p>
        <p className="font-mono text-[11px] text-muted">
          {kindLabel}
          {asset.durationSec ? ` · ${asset.durationSec.toFixed(1)}s` : ''}
          {asset.bytes ? ` · ${Math.round(asset.bytes / 1024)} KB` : ''}
        </p>
      </div>

      <dl className="mt-2 grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-[auto_1fr]">
        <Row label={dict.species.creditSource}>
          {c.sourceUrl ? (
            <a
              href={c.sourceUrl}
              rel="noopener nofollow"
              className="underline underline-offset-2 hover:text-ink"
            >
              {c.source}
              {c.sourceId ? ` (${c.sourceId})` : ''}
            </a>
          ) : (
            <>
              {c.source}
              {c.sourceId ? ` (${c.sourceId})` : ''}
            </>
          )}
        </Row>

        {c.recordist && <Row label={dict.species.creditRecordist}>{c.recordist}</Row>}

        <Row label={dict.species.creditLicence}>
          {c.verified && c.licenseUrl ? (
            <a
              href={c.licenseUrl}
              rel="noopener nofollow"
              className="underline underline-offset-2 hover:text-ink"
            >
              {c.license}
            </a>
          ) : (
            c.license
          )}
        </Row>
      </dl>

      {!c.verified && (
        <p className="mt-2 rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
          <span className="font-semibold">{dict.species.pendingVerification}.</span>{' '}
          {c.note}
        </p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink/80">{children}</dd>
    </>
  )
}
