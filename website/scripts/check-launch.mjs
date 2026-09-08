#!/usr/bin/env node
/**
 * Pre-launch gate.
 *
 * Several things in this site are deliberately, visibly unfinished: audio whose
 * licence is not yet confirmed, legal documents drafted from templates, and
 * store links that do not exist. Each is marked in the data or the copy, which
 * is the honest thing to do while building — and exactly the kind of marker
 * that survives to production because nobody remembers to look for it.
 *
 * So this script looks for them. It exits 0 during development with a report,
 * and exits 1 when run with --strict, which is how it should run in whatever
 * pipeline promotes this site to cicibird.com.
 *
 *   node scripts/check-launch.mjs            report only
 *   node scripts/check-launch.mjs --strict   fail if anything is outstanding
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')

const blockers = []
const notes = []

// ---------------------------------------------------------------------------
// 1. Audio provenance
// ---------------------------------------------------------------------------
const manifest = JSON.parse(
  readFileSync(join(ROOT, 'public/audio/manifest.json'), 'utf8'),
)
const assets = Object.values(manifest.assets)
const unverified = assets.filter((a) => !a.credit.verified)

for (const asset of unverified) {
  blockers.push(
    `audio/provenance  ${asset.id}\n    ${asset.credit.source}` +
      (asset.credit.sourceId ? ` (${asset.credit.sourceId})` : '') +
      `\n    ${asset.credit.note ?? 'No note recorded.'}`,
  )
}

// ---------------------------------------------------------------------------
// 2. Decode accuracy — overview.md §6 treats this as a release gate
// ---------------------------------------------------------------------------
const DECODE_FLOOR = 0.9
for (const asset of assets) {
  if (typeof asset.decodeAccuracy === 'number' && asset.decodeAccuracy < DECODE_FLOOR) {
    blockers.push(
      `audio/decode      ${asset.id} decodes at ` +
        `${(asset.decodeAccuracy * 100).toFixed(1)}%, below the ${DECODE_FLOOR * 100}% floor`,
    )
  }
}

// ---------------------------------------------------------------------------
// 3. Outstanding TODOs in shipped legal and product copy
// ---------------------------------------------------------------------------
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|json)$/.test(entry)) out.push(full)
  }
  return out
}

const legalTodos = []
for (const file of walk(join(ROOT, 'src/content'))) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes('TODO')) {
      legalTodos.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 110)}`)
    }
  })
}
for (const todo of legalTodos) blockers.push(`legal/todo        ${todo}`)

// ---------------------------------------------------------------------------
// 4. Store listings
// ---------------------------------------------------------------------------
const site = readFileSync(join(ROOT, 'src/lib/site.ts'), 'utf8')
if (/ios:\s*\{[^}]*available:\s*false/s.test(site)) {
  notes.push('App Store listing is marked unavailable; CTAs render as "coming soon".')
}
if (/android:\s*\{[^}]*available:\s*false/s.test(site)) {
  notes.push('Google Play listing is marked unavailable; CTAs render as "coming soon".')
}

// ---------------------------------------------------------------------------
// 5. Canonical host — cicibird.com is its own domain, never under cicicv.com
// ---------------------------------------------------------------------------
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cicibird.com'
if (!/^https:\/\/cicibird\.com\/?$/.test(siteUrl)) {
  blockers.push(
    `config/host       NEXT_PUBLIC_SITE_URL is "${siteUrl}". ` +
      `The canonical origin must be https://cicibird.com — CICI BIRD is a ` +
      `sibling of CICI CV, never a path or subdomain of cicicv.com.`,
  )
}

/**
 * The only place cicicv.com may appear in CODE is SITE.house.sibling, which
 * the footer renders as a peer link.
 *
 * Comments are stripped before the scan. Several modules explain the sibling
 * relationship in prose — that is documentation the next person needs, not a
 * dependency, and flagging it would train whoever runs this to ignore the
 * check. What we are actually looking for is cicicv.com reaching a URL, an
 * origin or a rendered string.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block and JSX comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1')   // line comments, sparing http://
}

const allowed = new Set(['src/lib/site.ts'])
for (const file of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, file)
  if (allowed.has(rel)) continue
  if (stripComments(readFileSync(file, 'utf8')).includes('cicicv.com')) {
    blockers.push(
      `config/host       cicicv.com used in ${rel}. It belongs only in ` +
        `SITE.house.sibling, rendered as a peer link in the footer.`,
    )
  }
}

// ---------------------------------------------------------------------------
// 6. Locale wiring: a route must render the locale of the tree it lives in
// ---------------------------------------------------------------------------
//
// The two route trees are near-identical files, so a /tr route is usually made
// by copying its English twin — and a missed `locale="en"` produces a page that
// still sets <html lang="tr-TR"> and still emits Turkish metadata, while
// rendering the whole body in English. Both dynamic TR routes shipped that way
// once. Nothing else catches it: the build passes, the route returns 200, and
// the difference is only visible by reading the rendered text.

for (const [group, expected] of [['(en)', 'en'], ['(tr)', 'tr']]) {
  const dir = join(ROOT, 'src', 'app', group)
  if (!existsSync(dir)) continue
  for (const file of walk(dir)) {
    const rel = relative(ROOT, file)
    const src = stripComments(readFileSync(file, 'utf8'))
    // Only the locale passed to a rendered component; generateMetadata calls
    // getDictionary('tr') with a quoted argument, which this does not match.
    for (const m of src.matchAll(/locale=\{?["']([a-z]{2})["']\}?/g)) {
      if (m[1] !== expected) {
        blockers.push(
          `i18n/locale       ${rel} renders locale="${m[1]}" inside the ` +
            `${group} tree. A ${group} route must pass "${expected}", or the ` +
            `page serves the wrong language under the right <html lang>.`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Turkish legal translation
// ---------------------------------------------------------------------------
notes.push(
  'Legal documents are served in English on both /x and /tr/x. Turkish ' +
    'versions are required before a Türkiye launch and must be translated ' +
    'with legal review, not machine-translated.',
)

// ---------------------------------------------------------------------------
// 8. Lab data provenance
// ---------------------------------------------------------------------------
//
// A voice-space file under src/data/lab/ describes ONE checkpoint: which real
// note each letter borrows and how bright the model renders it. The sparrow
// audio the page syncs to was rendered with the manifest's checkpoint. If the
// two differ, the plot lights up points describing notes nobody is hearing,
// and nothing about it looks wrong. The loader in src/data/lab.ts fails the
// prerender on that; this reports it in words first, and also flags a file
// that predates the current manifest so it is regenerated rather than trusted.
const labDir = join(ROOT, 'src/data/lab')
const labFiles = existsSync(labDir)
  ? readdirSync(labDir).filter((f) => f.endsWith('.json'))
  : []
for (const file of labFiles) {
  const lab = JSON.parse(readFileSync(join(labDir, file), 'utf8'))
  const slug = lab.meta?.speciesSlug
  const voice = manifest.trainedVoices?.[slug]
  if (!voice) {
    blockers.push(`lab/checkpoint    ${file}: no trained voice "${slug}" in the manifest`)
  } else if (voice.model !== lab.meta.checkpoint) {
    blockers.push(
      `lab/checkpoint    ${file} was measured against ${lab.meta.checkpoint}\n` +
        `    but the site's ${slug} audio was rendered with ${voice.model}.\n` +
        `    Run: npm run lab`,
    )
  } else if (lab.meta.manifestGeneratedAt !== manifest.generatedAt) {
    notes.push(
      `${file} predates the current audio manifest (same checkpoint, so the ` +
        `points are still right). Regenerate with npm run lab to keep the ` +
        `provenance stamp current.`,
    )
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const line = '─'.repeat(72)
console.log(`\n${line}\nCICI BIRD — pre-launch check\n${line}`)
console.log(`audio assets       ${assets.length}`)
console.log(`  verified         ${assets.length - unverified.length}`)
console.log(`  unverified       ${unverified.length}`)
console.log(`legal TODOs        ${legalTodos.length}`)
console.log(`lab data files     ${labFiles.length}`)

if (blockers.length) {
  console.log(`\n${line}\nBLOCKERS (${blockers.length}) — must be cleared before launch\n${line}`)
  for (const b of blockers) console.log(`\n  ${b}`)
} else {
  console.log('\nNo blockers.')
}

if (notes.length) {
  console.log(`\n${line}\nNOTES\n${line}`)
  for (const n of notes) console.log(`\n  · ${n}`)
}

console.log()
if (blockers.length && strict) {
  console.error(`Refusing to pass: ${blockers.length} blocker(s) outstanding.\n`)
  process.exit(1)
}
