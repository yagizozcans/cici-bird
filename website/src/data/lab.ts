import wrenJson from './lab/bewicks-wren-voice-space.json'
import sparrowJson from './lab/song-sparrow-voice-space.json'
import cardinalJson from './lab/northern-cardinal-voice-space.json'
import { getTrainedVoice } from './audio-manifest'
import type { VoiceSpaceData } from './lab-types'

/**
 * The Lab registry, and typed readers for its generated data.
 *
 * SERVER ONLY. This module imports the audio manifest, and the manifest is
 * ~100 KB that must never reach a client bundle. The voice-space data reaches
 * the browser as a prop from the server component, so each entry's page
 * carries only its own bird.
 *
 * An entry is metadata only — species, date, which audio it syncs to. Its
 * title and summary are copy and live in `dict.lab.entries[slug]`, keyed by
 * slug so the `Dictionary` type forces a Turkish version per entry.
 */

export type LabSlug =
  | 'wren-voice-space'
  | 'sparrow-voice-space'
  | 'cardinal-voice-space'

/**
 * What kind of body the entry renders. Every entry so far is a voice space —
 * the same plot with a different bird's numbers — so the view branches on
 * this, not on the slug. A genuinely different experiment adds a kind.
 */
export type LabKind = 'voice-space'

export interface LabEntry {
  slug: LabSlug
  kind: LabKind
  speciesSlug: string
  /** ISO date the entry was published. */
  date: string
  /** Manifest asset ids the entry plays, in the order its chips show them. */
  audioIds: string[]
}

// Ordered as the voices were trained, which is also the order they explain
// each other in: the wren first, then the two that followed its method.
export const LAB_ENTRIES: LabEntry[] = [
  {
    slug: 'wren-voice-space',
    kind: 'voice-space',
    speciesSlug: 'bewicks-wren',
    date: '2026-09-08',
    audioIds: ['sample-bewicks-wren', 'msg-bewicks-wren'],
  },
  {
    slug: 'sparrow-voice-space',
    kind: 'voice-space',
    speciesSlug: 'song-sparrow',
    date: '2026-09-08',
    audioIds: ['sample-song-sparrow', 'msg-song-sparrow'],
  },
  {
    slug: 'cardinal-voice-space',
    kind: 'voice-space',
    speciesSlug: 'northern-cardinal',
    date: '2026-09-08',
    audioIds: ['sample-northern-cardinal', 'demo-northern-cardinal'],
  },
]

export function labSlugs(): string[] {
  return LAB_ENTRIES.map((e) => e.slug)
}

export function getLabEntry(slug: string): LabEntry | null {
  return LAB_ENTRIES.find((e) => e.slug === slug) ?? null
}

// `band` is a two-number array in the JSON; the type calls it a tuple.
const VOICE_SPACES: Record<string, VoiceSpaceData> = {
  'bewicks-wren': wrenJson as unknown as VoiceSpaceData,
  'song-sparrow': sparrowJson as unknown as VoiceSpaceData,
  'northern-cardinal': cardinalJson as unknown as VoiceSpaceData,
}

/**
 * One bird's voice-space data, checked against the audio it is shown with.
 *
 * The points describe ONE checkpoint: each letter's motif is chosen from a
 * library the model's own feature cache defines, and its brightness is
 * measured on audio the model rendered. If the site's audio for this bird was
 * rendered with a different checkpoint than the file was measured against,
 * the plot would light up points describing notes nobody is hearing — and
 * nothing about it would look wrong. So a mismatch fails the prerender.
 * Regenerate with `npm run lab -- --species <ml key>` after `npm run audio`.
 */
export function voiceSpace(speciesSlug: string): VoiceSpaceData {
  const data = VOICE_SPACES[speciesSlug]
  if (!data) {
    throw new Error(
      `No voice-space data for "${speciesSlug}". Known: ${Object.keys(VOICE_SPACES).join(', ')}`,
    )
  }
  const voice = getTrainedVoice(speciesSlug)
  if (!voice) {
    throw new Error(
      `Lab data for "${speciesSlug}" but the manifest has no trained voice for it.`,
    )
  }
  if (voice.model !== data.meta.checkpoint) {
    throw new Error(
      `Lab data for ${speciesSlug} was measured against ${data.meta.checkpoint} but the ` +
        `site's audio was rendered with ${voice.model}. Run \`npm run lab\` to regenerate it.`,
    )
  }
  return data
}
