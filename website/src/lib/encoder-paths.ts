import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Where the encoder's Python lives, and whether it is here at all.
 *
 * SERVER ONLY — it touches the filesystem.
 *
 * Encoding needs torch, the checkpoints and the feature caches the motif
 * libraries are built from, so it is a local and self-hosted capability, not a
 * hosted one. Rather than let the button spin for two seconds and fail, the
 * views ask `encoderAvailable()` at prerender and say which of the two the
 * visitor is looking at.
 *
 * WHAT IT PROBES FOR IS THE WHOLE POINT, and the first version got it wrong.
 * It asked whether `ml/checkpoints` existed — but the checkpoints are only
 * ~570 KB each and are COMMITTED, so a git-integration build checks the whole
 * repo out and sees them. Production therefore prerendered an Encode button,
 * and the serverless function it posted to — which bundles only traced files,
 * with no ml/ and no Python — answered 503 (observed on cici-bird.vercel.app,
 * 2026-09-09). The check was true at build and false at runtime: two different
 * filesystems, one question.
 *
 * So probe for something that is GITIGNORED, and therefore cannot be in any
 * deploy by construction: the repo's own `.venv`. A developer's checkout has
 * it, a build container never does, and no configuration is needed either way.
 * A self-hoster using a system interpreter says so with ENCODE_PYTHON, which
 * is an explicit opt-in and is trusted as one.
 */

// Next runs with cwd = website/, so the repo root is one level up.
const ROOT = path.join(process.cwd(), '..')

export const SCRIPTS_DIR = path.join(ROOT, 'website', 'scripts')
export const ENCODE_SCRIPT = path.join(SCRIPTS_DIR, 'encode_once.py')

/** The venv requirements.txt pins, and the checkpoints were rendered with. */
const VENV_PYTHON = path.join(ROOT, '.venv', 'bin', 'python')

export function pythonBin(): string {
  return process.env.ENCODE_PYTHON ?? VENV_PYTHON
}

export function encoderAvailable(): boolean {
  if (process.env.ENCODE_PYTHON) return true
  return existsSync(VENV_PYTHON) && existsSync(ENCODE_SCRIPT)
}
