# cicibird.com

The CICI BIRD website, implementing `docs/website.md`.

**CICI BIRD is a standalone project under the CICI house and a sibling of
CICI CV — not a child of it.** The canonical origin is `https://cicibird.com`.
It is never `bird.cicicv.com` or `cicicv.com/bird`, and cicicv.com appears in
exactly one place in this codebase: `SITE.house.sibling`, rendered as a peer
link in the footer. `npm run check:launch` fails if that ever stops being true.

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

```bash
npm run build          # production build + sitemap
npm start
```

The audio assets and their manifest are committed, so a clone builds without
regenerating them. To rebuild them (macOS only — see *Audio pipeline*):

```bash
npm run audio
```

---

## What is where

| Path | What it is |
|---|---|
| `src/app/(en)/` | English routes — the unprefixed routes `website.md` §2 specifies |
| `src/app/(tr)/tr/` | Turkish routes, additive under `/tr` |
| `src/views/` | Page bodies, parameterised by locale and shared between both trees |
| `src/components/` | Player, subtitle track, catalog, chrome, consent |
| `src/data/species/*.json` | One file per species — content, not code |
| `src/data/messages.ts` | `/m/:id` fixtures **and the privacy model they encode** |
| `src/content/legal/` | The four legal/support documents |
| `src/lib/artwork.ts` | The voice-signature artwork generator |
| `src/components/TrainedVoicePanel.tsx` | The wren's model, decode accuracy and identification margin |
| `scripts/generate_audio.py` | The only writer of `public/audio/manifest.json` |
| `scripts/generate_lab.py` | The only writer of `src/data/lab/*.json` — per-letter motif measurements for the Lab |
| `src/data/lab.ts` | Lab registry (one entry per experiment) and the checkpoint-guarded data loader |
| `src/lib/voice-space.ts` | The Lab plot's projection: pure math shared by server render and client drag |
| `src/components/lab/` | The voice-space plot — stage SVG, letter readout, audio-synced session; one component, any bird |
| `scripts/check-launch.mjs` | Pre-launch gate |

### Two root layouts, on purpose

There is no `src/app/layout.tsx`. English and Turkish each have their own root
layout inside a route group, because `<html lang>` has to follow the language
while the required routes stay unprefixed and statically rendered. Reading the
locale from a cookie or header in one shared layout would make every route
dynamic and put the §3 LCP budget out of reach.

The cost of that split is that the two trees are near-identical files, so a
`/tr` route tends to be made by copying its English twin — and a missed
`locale="en"` yields a page that sets `<html lang="tr-TR">` and emits Turkish
metadata while rendering the entire body in English. Both dynamic TR routes
(`/tr/species/[slug]` and `/tr/m/[id]`) shipped that way until it was caught by
reading the rendered HTML; the build passes and the route returns 200 either
way. `check:launch` now asserts that every route in a tree passes that tree's
locale, so it cannot happen again silently.

---

## Audio pipeline

Every clip on the site is generated from the real code in this repo by
`scripts/generate_audio.py` — `../engine/birdsong_codec.py` for the protocol and
`../engine/voices.py` for the per-species voice, plus the trained DDSP model in
`../ml` for the Bewick's wren (see *The trained voice* below). Nothing is stock,
and no clip was hand-edited.

Because the codec places one note per character on a fixed 120 ms grid, the
script emits **exact subtitle cue timings** alongside each clip. The
synchronized subtitle on `/m/:id` is reading real timestamps, not animating a
guess.

The script also **decodes every encoded clip back to text and records the
accuracy**. `overview.md` §6 makes decode accuracy a release gate, so a voice
profile that drifts far enough to break comprehension fails the asset build
rather than shipping a message nobody can read. Of the 14 encoded clips, 13
round-trip at 100% and one — `sample-bewicks-wren`, from the trained model — at
96%. That number is published on the page rather than smoothed away; see
*The trained voice* below.

`public/audio/manifest.json` is the single source of truth for durations,
transcripts, decode accuracy, credits and licensing. **Nothing in `src/` states
any of those facts except by reading it** — that is how `website.md` §5's
"rendered from asset metadata, not hand-maintained" is enforced rather than
merely intended.

> **Platform note.** The script uses macOS `say` and `afconvert` (no ffmpeg
> dependency). On Linux, replace `afconvert` with `ffmpeg -c:a aac` and the
> `say` call with any TTS — or just use the committed assets.

---

## The trained voice (Bewick's wren)

Seven of the eight species are rendered by the **parametric** encoder in
`../engine`: a hand-authored synthesis profile playing one note per character
on a fixed 120 ms grid. The Bewick's wren is not. It is sung by the **trained
DDSP model at `../ml/checkpoints/wren.pt`**, fitted to 222 real recordings in
`../ml/data/bewicks_wren`, and three of the clips on this site are its real
output:

| Clip | Where it plays |
|---|---|
| `demo-bewicks-wren` | the landing-page demo, as one of the three voices |
| `sample-bewicks-wren` | the species catalog and the species page |
| `msg-bewicks-wren` | `/m/demo-wren`, the shared-message player |

Nothing about this voice is mocked or approximated. `scripts/generate_audio.py`
imports `ml/generate.py` directly, runs the checkpoint, and writes the result.

### What is actually different, and why the site says so

A trained voice does not sit on the codec's grid. It sequences note **motifs
borrowed out of the training recordings**, so the notes have real, unequal
durations and natural pacing — which is the whole point, and also the cost:

- **It cannot be decoded by an FFT.** There is no fixed symbol interval to
  window, so `ml/generate.py` reads it back with a Viterbi search over the
  model's own note templates instead.
- **It does not always decode perfectly.** 96% on the catalog sample. The
  species page prints that number, and prints the actual misreading beside it
  (`found you` → `fou d you`), because "96%" is abstract and *seeing which
  letter was dropped* is what tells a reader whether the number matters to
  them. The diff is a character-level LCS alignment, so a dropped character
  marks only itself instead of shifting the rest of the line into a false
  mismatch.
- **Subtitle timings cannot be computed.** For the parametric voices the cue
  grid is arithmetic. Here only the sequencer knows when each letter was sung,
  so `ml/generate.py` gained an opt-in `with_spans` return that hands back
  `[(char, start_frame, end_frame)]`. This is the **only change made to `ml/`**,
  and it is backward compatible: every existing caller gets the old two-tuple.

`TrainedVoicePanel` renders all of this from the manifest. Retraining the model
changes the page with no code edit, and a second trained voice is a data change
rather than a code change — `synthesis.method` is recorded per asset, never
keyed off the species slug.

### Two build-time checks worth knowing about

**Reproducibility: warm the net, *then* seed.** `ml/synth.py` draws from
`torch.rand`, so the asset build seeds torch to keep clips byte-stable. Seeding
first does not work: `DDSPDecoder(hidden=…)` initialises its weights randomly —
consuming RNG — before `load_state_dict` overwrites them, and the net is cached,
so only the first call pays that cost. The build therefore calls
`wren_ml._load_net()` first and seeds after.

**Messaging must not look like identification.** `app.md` §9 keeps the two
subsystems separate, and the wren decoder is closed-set: it always returns its
best explanation, so something has to decide whether to believe the text. The
asset build scores one of our messages and one wild recording and **exits
non-zero if they do not separate**. Current margin, published on the species
page: `+0.1855` vs `+0.0042` against a `0.115` threshold.

> `is_message()` in `ml/generate.py` hardcodes a relative
> `"checkpoints/wren.pt"`, so it only resolves when run from `ml/`. The asset
> build calls `decode_natural(..., return_score=True)` with an absolute path and
> compares against `wren_ml._MESSAGE_THRESHOLD`, so the threshold still lives in
> exactly one place.

---

## Species artwork

There is no illustration budget and no stock imagery. Each species' artwork is
a **picture of its voice**: the glide contour, vibrato, harmonic stack and
noise floor read from the audio manifest — the same numbers that synthesized
the clip playing next to it. Two species cannot collide, because two identical
marks would mean two identical-sounding birds.

One generator (`src/lib/artwork.ts`) feeds both the page and the Open Graph
card, so a species' thumbnail, header and social preview are literally the same
drawing. A ninth species gets correct artwork for free.

---

## Verification

```bash
npm run typecheck
npm run build
npm run check:launch
```

Median of three runs per route (Lighthouse 12, default mobile profile — Moto G
Power, 4× CPU throttle, simulated slow 4G):

| Route | Perf | A11y | SEO | Best practices | LCP | CLS |
|---|---|---|---|---|---|---|
| `/` | 98 | 100 | 100 | 100 | **2.3 s** | 0 |
| `/species` | 98 | 100 | 100 | 100 | **2.5 s** | 0 |
| `/species/bewicks-wren` | 98 | 100 | 100 | 100 | **2.3 s** | 0 |
| `/m/demo-wren` | 99 | 100 | 66¹ | 100 | **2.0 s** | 0 |
| `/privacy` | 99 | 100 | 100 | 100 | **2.0 s** | 0 |
| `/tr` | 98 | 100 | 100 | 100 | **2.3 s** | 0 |
| `/tr/species/bewicks-wren` | 99 | 100 | 100 | 100 | **2.2 s** | 0 |

¹ `/m/:id` is deliberately `noindex`; Lighthouse scores that as an SEO
deduction. Indexing an unguessable, revocable link would defeat the point of
it being unguessable and revocable.

**Read these with the median in mind.** Individual runs on a busy host swing by
±0.6 s — the same build measured `/tr` at 2.31 s and 2.85 s minutes apart — so a
single run is not evidence of a regression. `/species` is the heaviest route and
sits **at** the 2.5 s budget rather than under it; it is the one to watch when
anything is added to the catalog grid.

LCP here is not element-bound. Hiding the largest text block entirely moves
which element Lighthouse names but not when it paints (2461 ms vs 2458 ms on
`/species`), because FCP lands at 0.9 s and the remainder is the simulated
critical path under Lantern's throttling. Shaving LCP further means shortening
that path — render-blocking CSS and document bytes — not moving elements around.

### Two performance decisions worth knowing about

**No webfont.** The site was built with Inter via `next/font`. It cost 134 KB
across two woff2 files (latin + latin-ext, the second non-negotiable for
Turkish) and pushed LCP to 2.6 s — not because anything rendered late, but
because text painted at 0.9 s in the fallback and repainted when Inter arrived.
The native UI stack is already a clean neutral sans with full Turkish coverage
at zero bytes. See `src/lib/fonts.ts`.

**The consent banner is server-rendered and CSS-gated.** Mounting it from a
`useEffect` made it the LCP element at 3.6 s — a large fixed text block that
first paints after hydration *is* the largest contentful paint. It now ships in
the initial HTML, with a pre-paint inline script deciding visibility. See
`src/components/CookieConsent.tsx`.

---

## Before this goes live

`npm run check:launch:strict` exits non-zero while anything below is
outstanding. Wire it into whatever promotes this site to production.

### Blockers

**1. Audio provenance — 3 assets.**

| Asset | State |
|---|---|
| `call-nightingale` | xeno-canto **XC546355**. Recordist and licence unconfirmed. Confirm the required attribution string, or replace with a synthesized reference call. |
| `call-bewicks-wren` | From `data/bewicks_wren` (clip `173148`). Original archive entry not traced. Confirm, or replace. |
| `demo-human` | The landing demo's "pre-recorded human sentence" is currently macOS TTS. Replace with a real recorded voice. |

The site already tells the truth about these: unverified assets render a
"provenance pending verification" note instead of a confident credit, and the
JSON-LD says the same in machine-readable form. Nothing needs to be *hidden*
before launch — it needs to be *resolved*.

**2. Legal review — all four documents.** Every page carries a
`TODO: legal review required before launch` banner. Ten specific `TODO` spans
inside the copy mark decisions that need a real answer rather than placeholder
text: legal entity details, retention periods for identification audio and
location snapshots, the processor list, minimum age, governing law, the
liability cap, cross-platform entitlement restore, and the refund position in a
shutdown scenario. `check:launch` lists them with file and line.

**3. Turkish legal translation.** Legal documents are served in English on both
route trees, with a Turkish notice explaining that. This is deliberate — an
unreviewed machine translation of a privacy policy reads as authoritative and
is not. Turkish versions with legal review are required before a Türkiye
launch.

**4. Store listings.** `SITE.stores.*.available` is `false`, so every install
CTA renders as "coming soon" rather than as a link to a 404. Flip both flags
when the listings are live and every CTA on the site becomes a working link.

**5. Turkish characters in the encoder.** `engine/birdsong_codec.py` defines
its symbol alphabet as `a–z . , ' ?`, so ı ğ ş ç ö ü are normalised to spaces
on the way through. A Turkish sentence would arrive with holes in it. The
Turkish landing page says so in a note under the demo rather than
demonstrating mangled Turkish; the demo clip stays English. Extending the
alphabet is engine work, not website work, but it blocks a credible Türkiye
launch of the messaging feature.

**6. BirdNET licensing.** The credibility section says identification is built
on an established bioacoustic model. Model weights carry licence terms that
differ by release — commercial use needs the appropriately licensed model and
written confirmation from Cornell (`overview.md` §8).

---

## Deploying

Vercel, with `NEXT_PUBLIC_SITE_URL=https://cicibird.com` and `cicibird.com` as
the production domain. `check:launch` refuses any other canonical origin.

`/m/:id` is `force-dynamic` and must stay that way: a share link's state
changes after build, and a cached "active" render of a revoked message would
defeat the revocation the sender just performed. Every other route is
prerendered.

Audio is served from `/public/audio` with a one-year immutable cache and
`Accept-Ranges: bytes`, so clips stream rather than download in full. No audio
byte is fetched until someone presses play — verified: a cold landing-page load
makes **zero** requests to `/audio/`.

---

## The Lab

`/lab` holds one write-up per experiment. There are three, one per trained
voice — `/lab/wren-voice-space`, `/lab/sparrow-voice-space`,
`/lab/cardinal-voice-space` — each plotting all 31 letters of the codec's
alphabet on sweep slope, duration and pitch, lit up letter by letter as a
pre-rendered message plays.

They are the same experiment on three birds, so they are one component and one
piece of copy: `LAB_ENTRIES` carries a `kind`, `views/LabEntry.tsx` branches on
the kind rather than the slug, and no sentence in `dict.lab.voiceSpace` names a
species — the two that must say which bird take `{species}` and are filled in
from the species record. What differs between the pages is the numbers, and
those come from the data. Do not write a per-bird copy block; if a claim is
only true for one of them, it is the wrong claim. (It happened once: an early
draft said the three axes barely predict one another, which is true for the
sparrow and the cardinal and false for the wren, whose pitch and sweep slope
correlate +0.46.)

Their data is `src/data/lab/<species-slug>-voice-space.json`, written only by
`scripts/generate_lab.py`:

```bash
cd website && ../.venv/bin/python scripts/generate_lab.py   # or: npm run lab
```

With no `--species` that measures every trained voice in the manifest, which
is what regenerating has to mean once the Lab holds more than one bird.

Each file describes ONE checkpoint — which real note each letter borrows, and
how bright the model renders it — so it must match the checkpoint that bird's
audio on the site was rendered with. Three things enforce that: the script
takes its checkpoint from the audio manifest by default, `src/data/lab.ts`
throws at prerender on a mismatch, and `check-launch` reports it in words
first. Run `npm run lab` after any `npm run audio` that changes a trained
checkpoint.

The wren predates `ml/species.py`: its motifs, frequency map and renderer live
in `ml/generate.py`, not `generate_species.py`. `generate_lab.py` adapts it to
the same shape and measures it with the same code, so the three files are
comparable — a second copy of the measurement would be a second thing to keep
true. That is also why `meta.win` is null for the wren and `meta.source` names
the module each bird actually sings through.

The plot is inline SVG from a pure projection (`src/lib/voice-space.ts`), so
the page renders a real plot without JavaScript and adds no library. The
letter-by-letter sync uses the same per-character cues the subtitle bar
uses, from the manifest — the same measured note spans, not an animation.

Each page carries only its own bird's data, as a prop from the server. The
client component deliberately does NOT import the JSON: an ES import is
static, so all three files would land in the single `/lab/[slug]` chunk no
matter which entry the visitor opened.

## Not built, deliberately

`/account`, `/blog` and `/press` are v1.1 in `website.md` §2. They render a
`noindex` coming-soon page and nothing more. `/account` should not grow toward
a purchase flow: §7 is explicit that digital goods for the app cannot be sold
through the website.

The Lab is listen-only. There is no "type a message and watch it" mode,
because letter timings come from the audio build (`generate_audio.py` renders
the message through PyTorch and measures where each note landed); the browser
cannot synthesise a new one, and drawing a path without sound would be a
guess dressed as the real thing.
