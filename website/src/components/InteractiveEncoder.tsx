'use client'

import { useEffect, useRef, useState } from 'react'
import { AudioPlayer } from './AudioPlayer'
import { getDictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locale'
import type { Cue, PlayableAudio } from '@/data/audio-manifest'
import { track } from '@/lib/analytics'

/**
 * Type a sentence, hear it sung by a trained voice.
 *
 * The demo above it answers "what is this"; this answers "does it work on MY
 * words", which is the only version of the question a visitor actually has.
 * It plays without a signup because the whole claim is that it decodes — and a
 * claim you cannot check on your own sentence is a slogan.
 *
 * Owns no voice selection. The landing page has one picker driving both this
 * and the pre-rendered demo; a lab page has exactly one bird and no picker at
 * all. Both pass the active voice in.
 *
 * With `onResult` it hands the clip to its caller and renders no player of its
 * own. That is the lab: the voice space already owns a playhead in order to
 * light the letter being sung, and a second player for the same audio would
 * mean two positions that can disagree. Without it — the landing page — it
 * plays the result itself.
 *
 * `available` is resolved on the server (src/lib/encoder-paths.ts): encoding
 * needs torch, the checkpoints and the recording corpus, none of which deploy.
 * Saying so beats a button that spins for two seconds and fails.
 */

const EXAMPLES = [
  'meet me by the river at six.',
  'come home, it is late.',
  'good morning, neighbour.',
  'sing back to me.',
  'i heard you from the garden.',
]

const MAX_CHARS = 80

export interface EncoderVoice {
  slug: string
  name: string
  accent: string
}

interface EncodeResponse {
  src: string
  normalizedText: string
  decodedText: string
  decodeAccuracy: number
  durationSec: number
  cues: { chars: Cue[]; words: Cue[] }
}

export function InteractiveEncoder({
  locale,
  voice,
  available,
  showAlphabetNote = true,
  onResult,
  className = '',
}: {
  locale: Locale
  voice: EncoderVoice
  available: boolean
  /** False where a sibling already shows it — HeroDemo does, in the same card. */
  showAlphabetNote?: boolean
  /** Given, the caller plays the clip and this renders no player. */
  onResult?: (audio: PlayableAudio) => void
  className?: string
}) {
  const dict = getDictionary(locale)
  const copy = dict.encoder
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [result, setResult] = useState<EncodeResponse | null>(null)
  const idle = value === '' && !focused
  const ghost = usePlaceholder(idle && available, copy.placeholderStatic)

  async function encode() {
    setBusy(true)
    setFailed(false)
    setResult(null)
    track('encode_submit', { voice: voice.slug })
    try {
      const response = await fetch('/api/encode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: value.slice(0, MAX_CHARS), voice: voice.slug }),
      })
      if (!response.ok) throw new Error(String(response.status))
      const encoded = (await response.json()) as EncodeResponse
      if (onResult) onResult(toPlayableResult(encoded, voice.slug))
      else setResult(encoded)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  if (!available) {
    return (
      <div className={className}>
        <Heading title={copy.title} />
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{copy.unavailable}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <Heading title={copy.title} />

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          if (value.trim() && !busy) void encode()
        }}
      >
        {/* The animated placeholder cannot be the `placeholder` attribute — that
            cannot carry a caret — so it is an overlay that must sit on the same
            box metrics as the input, and stay out of the pointer's way. */}
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            maxLength={MAX_CHARS}
            aria-label={copy.placeholderStatic}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full rounded-full border border-line bg-paper px-4 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-ink/40"
          />
          {idle && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-4 text-[14px] text-muted"
            >
              {ghost.text}
              {ghost.animated && <span className="animate-caret">|</span>}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!value.trim() || busy}
          className="rounded-full border border-ink bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-muted"
        >
          {busy ? copy.encoding : copy.button}
        </button>
      </form>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">{copy.hint}</p>
      {/* Only the Turkish dictionary fills this in — the alphabet has no
          ı ğ ş ç ö ü, and this is the input where that starts to matter. */}
      {showAlphabetNote && dict.demo.alphabetNote && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted">{dict.demo.alphabetNote}</p>
      )}

      {failed && <p className="mt-3 text-[12px] text-ochre-deep">{copy.error}</p>}

      {result && (
        <div className="mt-4">
          {/* Fresh player per encode: a new message must stop the previous one
              and reset the playhead, not inherit its position. */}
          <AudioPlayer
            key={result.src}
            audio={toPlayableResult(result, voice.slug)}
            label={copy.resultLabel}
            variant="feature"
            accentColor={voice.accent}
            playLabel={dict.demo.play}
            pauseLabel={dict.demo.pause}
            subtitleHint={dict.demo.transcriptNote}
          />
          <p className="mt-3 text-[12px] text-muted">
            <span className="font-medium text-ink">
              {dict.demo.accuracyLabel}: {Math.round(result.decodeAccuracy * 100)}%
            </span>{' '}
            — {dict.demo.accuracyNoteNeural}
          </p>
        </div>
      )}
    </div>
  )
}

function Heading({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
  )
}

/**
 * The manifest's `toPlayable` shape, built from an API response instead.
 *
 * It cannot be reused directly: it reads the ~100 KB manifest and so is
 * server-only, and this clip is not in the manifest at all. `text` is the
 * NORMALIZED string, because that is what the cues are indexed against — the
 * subtitle would drift against the raw input the moment a character folded to
 * a space.
 */
function toPlayableResult(result: EncodeResponse, slug: string): PlayableAudio {
  return {
    // The text is in the id because consumers key off it. The voice space
    // remounts its player per message id, so a second encode of a DIFFERENT
    // sentence has to look like a different message — otherwise the plot
    // would keep singing the first one.
    id: `encode-${slug}-${result.normalizedText}`,
    src: result.src,
    mime: 'audio/wav',
    durationSec: result.durationSec,
    text: result.normalizedText,
    cues: result.cues.chars,
    wordCues: result.cues.words,
    decodeAccuracy: result.decodeAccuracy,
    synthesis: null,
  }
}

/**
 * A typewriter that never fully clears.
 *
 * Deleting everything and retyping reads as a slideshow; morphing through the
 * common prefix reads as someone changing their mind, which is what the input
 * is asking the visitor to do. So each tick deletes 1-3 characters while the
 * text is not a prefix of the next example, then types 1-3 until it matches.
 *
 * The current text is held in a ref and advanced OUTSIDE the state updater.
 * Two reasons, both real: the tick's delay depends on the character that was
 * just produced (a completed sentence pauses 1200ms, a character 80-120ms), so
 * it has to be known before the timer is scheduled; and next.config.mjs sets
 * reactStrictMode, which double-invokes updaters in development — a Math.random
 * inside one would advance the animation twice per tick.
 */
function usePlaceholder(active: boolean, fallback: string) {
  const [shown, setShown] = useState('')
  const [animated, setAnimated] = useState(false)
  const text = useRef('')
  const target = useRef(0)

  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setAnimated(true)

    let timer: ReturnType<typeof setTimeout>
    const step = () => {
      const want = EXAMPLES[target.current]
      let delay: number
      if (text.current === want) {
        target.current = (target.current + 1) % EXAMPLES.length
        delay = 1200
      } else {
        const n = 1 + Math.floor(Math.random() * 3)
        text.current = want.startsWith(text.current)
          ? want.slice(0, text.current.length + n)
          : text.current.slice(0, Math.max(0, text.current.length - n))
        setShown(text.current)
        delay = 80 + Math.random() * 40
      }
      timer = setTimeout(step, delay)
    }
    timer = setTimeout(step, 400)
    return () => {
      clearTimeout(timer)
      setAnimated(false)
    }
  }, [active])

  if (!active) return { text: '', animated: false }
  return animated ? { text: shown, animated: true } : { text: fallback, animated: false }
}
