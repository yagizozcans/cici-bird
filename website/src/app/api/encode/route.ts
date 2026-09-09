import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'
import type { Cue } from '@/data/audio-manifest'
import {
  ENCODE_SCRIPT,
  SCRIPTS_DIR,
  encoderAvailable,
  pythonBin,
  serviceUrl,
} from '@/lib/encoder-paths'

/**
 * POST /api/encode — a visitor's sentence, sung by a trained voice.
 *
 * Two backends, one renderer. In production this proxies to the hosted encoder
 * (service/, a Docker Space); on a developer's machine it spawns the repo's
 * Python. Both run the same `encode_once.encode`, so the audio does not depend
 * on which one answered. This route only validates, rate-limits and caches.
 *
 * SERIALIZED, and not merely for backpressure: ml/generate.py's
 * `_template_bank` mutates a module-global `_SIG_MEAN`, so decoding two
 * checkpoints at once inside one interpreter mis-centres one of them. The
 * local path gets safety from a process per request; the queue here keeps the
 * machine from being asked for three at a time either way. The service takes
 * the same lock on its own side.
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

// Encoding is ~0.5s of CPU on a free-tier host, so an open endpoint is a free
// CPU faucet. Ten a minute is far more than anyone types by hand and far less
// than a script wants. In-memory and per-instance: this bounds one machine's
// load, it is not a security control, and a serverless fleet weakens it — the
// 80-char cap and the cache are what bound the worst case.
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

interface EncodeResult {
  src: string
  text: string
  normalizedText: string
  decodedText: string
  decodeAccuracy: number
  durationSec: number
  cues: { chars: Cue[]; words: Cue[] }
}

interface WorkerPayload {
  normalizedText: string
  decodedText: string
  decodeAccuracy: number
  durationSec: number
  cues: { chars: Cue[]; words: Cue[] }
  wavBase64: string
}

// Module state does not survive a dev hot-reload; globalThis does.
const store = globalThis as typeof globalThis & {
  __encodeCache?: Map<string, EncodeResult>
  __encodeQueue?: Promise<unknown>
  __encodeHits?: Map<string, number[]>
}
const cache = (store.__encodeCache ??= new Map<string, EncodeResult>())
const hits = (store.__encodeHits ??= new Map<string, number[]>())

/** Run `task` after every earlier one has settled. */
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = (store.__encodeQueue ?? Promise.resolve()).then(task, task)
  // Keep the chain alive on failure — a rejected link must not poison the rest.
  store.__encodeQueue = next.catch(() => undefined)
  return next
}

function overRateLimit(request: Request): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'local'
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  // The map would otherwise grow one entry per IP forever.
  if (hits.size > 5000) hits.clear()
  return recent.length > RATE_LIMIT
}

async function viaService(url: string, text: string, voice: string): Promise<WorkerPayload> {
  // The free tier sleeps when idle, and waking it means a container boot plus
  // the torch import. Wait for that rather than reporting a failure the user
  // would only retry into.
  const response = await fetch(`${url}/encode`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw new Error(`service ${response.status}`)
  return (await response.json()) as WorkerPayload
}

async function viaLocalPython(text: string, voice: string): Promise<WorkerPayload> {
  const { stdout } = await execFileAsync(
    pythonBin(),
    [ENCODE_SCRIPT, '--text', text, '--voice', voice],
    { cwd: SCRIPTS_DIR, maxBuffer: MAX_BUFFER },
  )
  return JSON.parse(stdout) as WorkerPayload
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
  // A cached answer costs nothing, so it should not spend anyone's allowance.
  if (hit) return NextResponse.json(hit)

  if (overRateLimit(request)) {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429 })
  }

  const url = serviceUrl()
  let out: WorkerPayload
  try {
    out = await serialize(() =>
      url ? viaService(url, text, voice) : viaLocalPython(text, voice),
    )
  } catch (error) {
    console.error('[encode]', error)
    return NextResponse.json({ error: 'encode-failed' }, { status: 500 })
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
