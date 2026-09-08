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
