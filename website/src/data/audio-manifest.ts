import manifestJson from '../../public/audio/manifest.json'

/**
 * Typed reader for public/audio/manifest.json.
 *
 * website.md §5 requires audio credits and licensing attributions to be
 * "rendered from asset metadata, not hand-maintained". This module is how that
 * requirement is enforced: nothing in src/ may state a duration, a decoded
 * transcript, a licence or a recordist except by reading it from here, and the
 * manifest has exactly one writer — scripts/generate_audio.py.
 *
 * The manifest is imported rather than fetched so a missing or renamed asset
 * is a build failure, not a broken player discovered by a visitor.
 */

export type AssetKind =
  | 'real-call'
  | 'synth-reference'
  | 'encoded-message'
  | 'human-speech'

export interface AssetCredit {
  title: string
  kind: AssetKind
  source: string
  license: string
  /** False while the licence and recordist are still unconfirmed. */
  verified: boolean
  sourceId?: string
  sourceUrl?: string
  recordist?: string
  licenseUrl?: string
  note?: string
}

/**
 * How a clip was actually made.
 *
 * Seven of the ten species are rendered by the parametric encoder in
 * engine/voices.py — a hand-authored synthesis profile over a fixed frequency
 * grid. The Bewick's wren (ml/checkpoints/wren.pt, fitted to 222 recordings),
 * the song sparrow (ml/checkpoints/sparrow_win256.pt, 250 clips from 114
 * recordings) and the northern cardinal (ml/checkpoints/cardinal_best250.pt,
 * 250 clips from 47 recordings) are not: they have trained DDSP models, their
 * messages are sequenced from note motifs borrowed out of those recordings,
 * and they are read back by a Viterbi decoder rather than an FFT.
 *
 * That difference is visible to the visitor — different timbre, different
 * pacing, and a decode accuracy that is measured rather than assumed — so the
 * site states it. Recording it per asset rather than keying off the species
 * slug is what made the second and third trained voices a data change:
 * nothing in src/ needed editing to render the sparrow's or the cardinal's
 * panel.
 */
export interface Synthesis {
  method: 'parametric' | 'neural-ddsp'
  engine: string
  decoder: string
  /** Checkpoint path, for a trained voice. */
  model?: string
  trainedOn?: string
}

/**
 * Evidence that a trained voice's output is distinguishable from a real bird.
 *
 * app.md §9 keeps identification and messaging as separate subsystems, and the
 * wren's decoder is closed-set — it always returns its best explanation, so
 * something has to decide whether to believe the text. These are the scores
 * that decision produced for the clips this site publishes, measured at asset
 * build time, not quoted from an earlier calibration run.
 */
export interface IdentificationCheck {
  messageScore: number
  wildScore: number
  threshold: number
  separated: boolean
}

export interface TrainedVoice {
  model: string
  corpus: string
  corpusSize: number
  sampleRate: number
  identification: IdentificationCheck | null
}

export interface Cue {
  t0: number
  t1: number
  text: string
}

export interface AudioAsset {
  id: string
  src: string
  mime: string
  bytes: number
  credit: AssetCredit
  speciesSlug?: string
  durationSec?: number
  /** Original text, for encoded messages. */
  text?: string
  normalizedText?: string
  /** What the decoder actually read back out of this exact file. */
  decodedText?: string
  decodeAccuracy?: number
  cues?: { chars: Cue[]; words: Cue[] }
  synthesis?: Synthesis
}

export interface VoiceProfile {
  glideHz: number
  glideShape: 'up' | 'down' | 'arch'
  vibratoHz: number
  vibratoDepth: number
  harmonics: [number, number][]
  noise: number
}

interface Manifest {
  generatedAt: string
  generator: string
  engine: {
    protocol: string
    voices: string
    sampleRate: number
    symbolSeconds: number
    freqMinHz: number
    freqMaxHz: number
  }
  trainedVoices: Record<string, TrainedVoice>
  voiceProfiles: Record<string, VoiceProfile>
  assets: Record<string, AudioAsset>
}

const manifest = manifestJson as unknown as Manifest

export const AUDIO_ENGINE = manifest.engine
export const MANIFEST_GENERATED_AT = manifest.generatedAt

/** Throws on an unknown id — a typo should break the build, not the page. */
export function getAsset(id: string): AudioAsset {
  const asset = manifest.assets[id]
  if (!asset) {
    throw new Error(
      `Unknown audio asset "${id}". Known ids: ${Object.keys(manifest.assets).join(', ')}`,
    )
  }
  return asset
}

export function getAssetOrNull(id: string): AudioAsset | null {
  return manifest.assets[id] ?? null
}

export function getVoiceProfile(slug: string): VoiceProfile | null {
  return manifest.voiceProfiles[slug] ?? null
}

/** The trained model behind a species, or null if it uses a parametric voice. */
export function getTrainedVoice(slug: string): TrainedVoice | null {
  return manifest.trainedVoices?.[slug] ?? null
}

export function allAssets(): AudioAsset[] {
  return Object.values(manifest.assets)
}

/**
 * Every asset whose provenance is still unconfirmed.
 *
 * Used by the species pages to render an honest "pending verification" note
 * instead of a confident credit line, and by `npm run check:provenance` to
 * fail a pre-launch build while any of them remain.
 */
export function unverifiedAssets(): AudioAsset[] {
  return allAssets().filter((a) => !a.credit.verified)
}

/**
 * A single client-safe payload for one playable clip.
 *
 * Server components pass this to the player instead of handing the whole
 * manifest to the browser — character cues for 22 assets would be a pointless
 * ~100 KB on a page that plays one of them.
 */
export interface PlayableAudio {
  id: string
  src: string
  mime: string
  durationSec: number
  text: string | null
  cues: Cue[]
  wordCues: Cue[]
  /** Present for encoded messages; drives the "decoded back at N%" line. */
  decodeAccuracy: number | null
  synthesis: Synthesis | null
}

// Audio lives at STABLE paths (/audio/species/bewicks-wren-encoded.m4a), and a
// browser caches those aggressively. Regenerating the assets therefore changes
// nothing for anyone who has already played them — the model can be retrained
// and the site will keep serving the old voice until the cache expires. Nobody
// hard-reloads a marketing page, so the fix belongs here, not in an instruction
// to the visitor: stamp every URL with the manifest's build time, so new audio
// is a new URL and the old one is simply never requested again.
const AUDIO_VERSION = encodeURIComponent(manifest.generatedAt)

export function versionedSrc(src: string): string {
  return src.includes('?') ? `${src}&v=${AUDIO_VERSION}` : `${src}?v=${AUDIO_VERSION}`
}

export function toPlayable(id: string): PlayableAudio {
  const asset = getAsset(id)
  return {
    id: asset.id,
    src: versionedSrc(asset.src),
    mime: asset.mime,
    durationSec: asset.durationSec ?? 0,
    text: asset.text ?? null,
    cues: asset.cues?.chars ?? [],
    wordCues: asset.cues?.words ?? [],
    decodeAccuracy: asset.decodeAccuracy ?? null,
    synthesis: asset.synthesis ?? null,
  }
}
