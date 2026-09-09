import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * How this deployment encodes, and whether it can at all.
 *
 * SERVER ONLY — it touches the filesystem.
 *
 * Two ways to render, one implementation behind both. `service/` runs the same
 * `encode_once.encode` this repo shells out to locally, so a hosted clip and a
 * local one are the same audio; only the transport differs.
 *
 *   ENCODE_SERVICE_URL set   -> POST to the hosted encoder (production)
 *   otherwise, .venv present -> spawn the repo's Python (a developer's machine)
 *   neither                  -> say so, and render no button
 *
 * WHAT THE LOCAL CHECK PROBES FOR IS THE WHOLE POINT, and the first version got
 * it wrong. It asked whether `ml/checkpoints` existed — but the checkpoints are
 * only ~570 KB each and are COMMITTED, so a git-integration build checks the
 * whole repo out and sees them. Production therefore prerendered an Encode
 * button, and the serverless function it posted to — which bundles only traced
 * files, with no ml/ and no Python — answered 503 (observed on
 * cici-bird.vercel.app, 2026-09-09). True at build, false at runtime: two
 * filesystems, one question.
 *
 * So probe for something GITIGNORED, and therefore absent from any deploy by
 * construction: the repo's own `.venv`. A developer's checkout has it, a build
 * container never does, and neither needs configuring. An env var, by
 * contrast, is the same string in both places — which is exactly why the
 * hosted path is expressed as one.
 */

// Next runs with cwd = website/, so the repo root is one level up.
const ROOT = path.join(process.cwd(), '..')

export const SCRIPTS_DIR = path.join(ROOT, 'website', 'scripts')
export const ENCODE_SCRIPT = path.join(SCRIPTS_DIR, 'encode_once.py')

/** The venv requirements.txt pins, and the checkpoints were rendered with. */
const VENV_PYTHON = path.join(ROOT, '.venv', 'bin', 'python')

/** The hosted encoder, if this deployment has one. */
export function serviceUrl(): string | null {
  const url = process.env.ENCODE_SERVICE_URL?.trim()
  return url ? url.replace(/\/$/, '') : null
}

export function pythonBin(): string {
  return process.env.ENCODE_PYTHON ?? VENV_PYTHON
}

export function localEncoderPresent(): boolean {
  if (process.env.ENCODE_PYTHON) return true
  return existsSync(VENV_PYTHON) && existsSync(ENCODE_SCRIPT)
}

export function encoderAvailable(): boolean {
  return serviceUrl() !== null || localEncoderPresent()
}
