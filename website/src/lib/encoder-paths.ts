import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Where the encoder's Python lives, and whether it is here at all.
 *
 * SERVER ONLY — it touches the filesystem.
 *
 * The site deploys `website/` and nothing else (`.vercelignore`), while
 * encoding needs torch, the checkpoints in `ml/`, and the feature caches the
 * motif libraries are built from. So live encoding is a local and self-hosted
 * capability, not a hosted one. Rather than let the button spin for two seconds
 * and fail, the views ask `encoderAvailable()` at prerender — true on a
 * developer's machine, false in the build container — and say which one the
 * visitor is looking at.
 */

// Next runs with cwd = website/, so the repo root is one level up.
const ROOT = path.join(process.cwd(), '..')

export const SCRIPTS_DIR = path.join(ROOT, 'website', 'scripts')
export const ENCODE_SCRIPT = path.join(SCRIPTS_DIR, 'encode_once.py')

/** The venv the checkpoints were rendered with (requirements.txt pins it). */
export function pythonBin(): string {
  const configured = process.env.ENCODE_PYTHON
  if (configured) return configured
  const venv = path.join(ROOT, '.venv', 'bin', 'python')
  return existsSync(venv) ? venv : 'python3'
}

export function encoderAvailable(): boolean {
  return existsSync(ENCODE_SCRIPT) && existsSync(path.join(ROOT, 'ml', 'checkpoints'))
}
