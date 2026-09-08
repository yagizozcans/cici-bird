import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'
import type { Cue } from '@/data/audio-manifest'
import {
  ENCODE_SCRIPT,
  SCRIPTS_DIR,
  encoderAvailable,
  pythonBin,
} from '@/lib/encoder-paths'

/**
 * POST /api/encode — a visitor's sentence, sung by a trained voice.
 *
 * The whole synthesis lives in `scripts/encode_once.py`; this route only
 * validates, spawns and caches. Two properties are load-bearing:
 *
 * ONE AT A TIME. ml/generate.py's `_template_bank` mutates a module-global
 * `_SIG_MEAN`, so decoding two checkpoints concurrently inside one interpreter
 * silently mis-centres one of them. A process per request plus this queue makes
 * that impossible rather than merely unlikely. A cold run measures ~1.6s, which
 * is what the button's loading state is for.
 *
 * NO SHELL. execFile with an argv array, so the visitor's text is an argument
 * and never a token the shell can read.
 */

const execFileAsync = promisify(execFile)

const VOICES = ['bewicks-wren', 'song-sparrow', 'northern-cardinal']
const MAX_CHARS = 80
/** A 5s message is ~140 KB of base64; 80 chars cannot reach 32 MB. */
const MAX_BUFFER = 32 * 1024 * 1024
const CACHE_LIMIT = 50

interface EncodeResult {
  src: string
  text: string
  normalizedText: string
  decodedText: string
  decodeAccuracy: number
  durationSec: number
  cues: { chars: Cue[]; words: Cue[] }
}

// Module state does not survive a dev hot-reload; globalThis does.
const store = globalThis as typeof globalThis & {
  __encodeCache?: Map<string, EncodeResult>
  __encodeQueue?: Promise<unknown>
}
const cache = (store.__encodeCache ??= new Map<string, EncodeResult>())

/** Run `task` after every earlier one has settled. */
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = (store.__encodeQueue ?? Promise.resolve()).then(task, task)
  // Keep the chain alive on failure — a rejected link must not poison the rest.
  store.__encodeQueue = next.catch(() => undefined)
  return next
}

export async function POST(request: Request) {
  let body: { text?: unknown; voice?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }

  const voice = String(body.voice ?? '')
  const text = String(body.text ?? '').slice(0, MAX_CHARS)
  if (!VOICES.includes(voice) || !text.trim()) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }
  if (!encoderAvailable()) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const key = `${voice} ${text}`
  const hit = cache.get(key)
  if (hit) return NextResponse.json(hit)

  let stdout: string
  try {
    const run = await serialize(() =>
      execFileAsync(pythonBin(), [ENCODE_SCRIPT, '--text', text, '--voice', voice], {
        cwd: SCRIPTS_DIR,
        maxBuffer: MAX_BUFFER,
      }),
    )
    stdout = run.stdout
  } catch (error) {
    console.error('[encode]', error)
    return NextResponse.json({ error: 'encode-failed' }, { status: 500 })
  }

  const out = JSON.parse(stdout) as {
    normalizedText: string
    decodedText: string
    decodeAccuracy: number
    durationSec: number
    cues: { chars: Cue[]; words: Cue[] }
    wavBase64: string
  }

  const result: EncodeResult = {
    src: `data:audio/wav;base64,${out.wavBase64}`,
    text,
    normalizedText: out.normalizedText,
    decodedText: out.decodedText,
    decodeAccuracy: out.decodeAccuracy,
    durationSec: out.durationSec,
    cues: out.cues,
  }

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
  cache.set(key, result)
  return NextResponse.json(result)
}
