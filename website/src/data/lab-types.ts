/**
 * Shapes of the generated Lab data files under src/data/lab/.
 *
 * This module has NO imports on purpose. The client component that draws the
 * voice space (components/lab/VoiceSpace) receives one of these as a prop and
 * needs its type, but must not reach `data/lab.ts` for it — that module
 * imports the full audio manifest and has to stay on the server.
 */

/** One letter of the codec's alphabet, as the trained model actually sings it. */
export interface VoiceSpaceLetter {
  ch: string
  /** Index into the species' shape library — which real note this letter borrowed. */
  idx: number
  /** Assigned pitch, Hz. Exactly `meta.base + i * meta.step`; the protocol, not a measurement. */
  pitch: number
  /** Note length, ms. */
  dur: number
  /** Linear-fit pitch slope over the note, Hz/s. Negative = falling. */
  slope: number
  /** Total pitch travel inside the note, Hz. */
  span: number
  /** Spectral centroid of the rendered note, Hz. */
  bright: number
  /** Spectral flatness of the rendered note, 0..1. Higher = noisier. */
  flat: number
  /** How far the borrowed note was moved from the pitch it was really sung at, Hz. */
  transplant: number
  /** Pitch contour, `meta.points` samples across the note, Hz. */
  f0: number[]
  /** Loudness envelope, `meta.points` samples, normalised to a peak of 1. */
  env: number[]
}

export interface VoiceSpaceMeta {
  species: string
  key: string
  speciesSlug: string
  /** Root-relative checkpoint path, in the same form the audio manifest uses. */
  checkpoint: string
  checkpointMatchesManifest: boolean
  manifestGeneratedAt: string
  generatedAt: string
  generator: string
  /** Which ml/ module sequences this bird's messages — the wren has its own. */
  source: string
  band: [number, number]
  /** Null for a bird whose feature cache records no analysis window. */
  win: number | null
  /** Usable notes harvested from the corpus — the pool letters were assigned from. */
  libNotes: number
  base: number
  step: number
  sampleRate: number
  frameRate: number
  nLetters: number
  points: number
  /** Pearson r between attributes, over all letters. Why the axes are what they are. */
  correlations: {
    pitchBright: number
    pitchDur: number
    pitchSlope: number
    durSlope: number
  }
}

export interface VoiceSpaceData {
  meta: VoiceSpaceMeta
  letters: VoiceSpaceLetter[]
}

/* ------------------------------------------------------------------------ */
/* wild voices — real field recordings, read by our decoder                  */
/* ------------------------------------------------------------------------ */

/** One field recording of the bird itself, and what the decoder made of it. */
export interface WildClip {
  id: string
  /** Root-relative path under public/. Version it before use — see the note
   *  on cache-busting in data/audio-manifest.ts. */
  src: string
  mime: string
  bytes: number
  durationSec: number
  /** Filename in the training corpus, so a clip can be traced back. */
  file: string
  sourceId: string
  sourceUrl: string
  recordist: string
  license: string
  licenseUrl: string
  country: string
  location: string
  date: string
  soundType: string
  decoded: {
    /** Letters the Viterbi search returned. Nonsense, and meant to be. */
    text: string
    /** Whole-signal score per column — the statistic the threshold is on. */
    score: number
    /** score >= threshold. If this is ever true the section's claim is wrong. */
    isMessage: boolean
  }
}

export interface WildVoicesMeta {
  species: string
  key: string
  speciesSlug: string
  checkpoint: string
  checkpointMatchesManifest: boolean
  manifestGeneratedAt: string
  generatedAt: string
  generator: string
  /** Which ml/ module decoded these — the wren has its own. */
  decoder: string
  corpus: string
  /** Clips in the corpus, and how many of them are licensed to be shown. */
  corpusClips: number
  licensablePool: number
  /** Distinct field recordings the clips came from. 1 when the licence
   *  pool is one recording, which is the wren's case. */
  sourceRecordings: number
  sampleRate: number
  nClips: number
  /** Above this score the decoder's reading is believed. */
  threshold: number
  /** What the same decoder scores on this voice's own encoded message. */
  messageScore: number
  /** Clip ids that scored above threshold. Empty, or the page is lying. */
  readAsMessage: string[]
}

export interface WildVoicesData {
  meta: WildVoicesMeta
  clips: WildClip[]
}
