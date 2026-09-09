# service/ — the hosted encoder

Live encoding needs torch, the three checkpoints and a motif library. The site
deploys `website/` to Vercel alone, and torch is ~200 MB against a 250 MB
function limit, so the encoder runs here instead and `/api/encode` proxies to
it. Same `encode_once.encode` on both sides — there is one renderer, and the
transport is the only difference between a local clip and a hosted one.

It deploys as a **Gradio Space**, so there is no Dockerfile: Hugging Face
installs `requirements.txt` and runs `app.py` itself. Gradio is mounted at `/`
— which gives the models a page someone can actually try, and answers the
platform's health check — with `POST /encode` beside it as a plain FastAPI
route. The site uses that one because it is a single request with a JSON body;
Gradio's own REST API is a two-step call-then-poll, and the site does not need
a queue to talk to itself.

## Why the corpus is not deployed

The shape library is ~1,100–1,600 real notes per species. But `motif_assignment`
picks exactly one per symbol and the choice is deterministic (`_MOTIF_SEED`), so
**only 31 notes per voice are ever sung**. `freeze_motifs.py` writes those to
`motifs.json`, and `preload.py` fills ml/'s caches from it before the first
render, so the library is never built.

| | |
|---|---|
| corpus + feature caches | 3.6 GB + 3 × 65 MB |
| `motifs.json` | 172 KB |
| whole Space | 2.1 MB |

Verified, not assumed: with the motifs preloaded and the corpus and feature
caches made unreachable, all three voices render audio **bit-identical** to the
full-corpus path and still decode at 100%. Decoding works too, because the
template bank is rendered from the motifs by the model rather than read from the
recordings.

`preload.assert_offline` then makes every remaining route to disk raise. If a
change ever reaches past the motifs, that is a crash at startup and not a bird
that quietly became a different bird.

## Deploying

1. **Create the Space.** On huggingface.co: *New* → *Space*, SDK **Gradio**,
   hardware **CPU basic (free)**. Note its git URL. No Docker involved.

2. **Assemble and push.** The Space directory is built, never hand-maintained —
   it is a copy of the files the encoder imports, laid out the way this repo
   lays them out so `generate_audio.py`'s `parents[2]` still resolves.

   ```bash
   ./service/build_space.sh          # writes dist/space (gitignored)
   cd dist/space
   git init -b main && git add -A && git commit -m "cici bird encoder"
   git remote add origin https://huggingface.co/spaces/<you>/<space>
   git push -u origin main
   ```

   The build takes a few minutes, mostly the torch wheel. Watch the Space's
   *Logs* tab; `warm: all three voices loaded` means it is ready, and the
   Space's own page is a working demo of the three voices.

3. **Lock it to your site.** In the Space's *Settings → Variables*, set
   `ALLOWED_ORIGIN` to your deployed origin. It defaults to
   `https://cici-bird.vercel.app`, and it is a CORS allowlist rather than `*`
   because an open endpoint is a free CPU faucet.

4. **Point the site at it.** In Vercel → *Settings → Environment Variables*:

   ```
   ENCODE_SERVICE_URL = https://<you>-<space>.hf.space
   ```

   Then redeploy. `encoderAvailable()` is evaluated when the page is
   prerendered, so the button appears only in a build that had this variable —
   setting it without redeploying changes nothing.

   ```bash
   curl -X POST https://<you>-<space>.hf.space/encode \
     -H 'content-type: application/json' \
     -d '{"text":"meet me by the river at six.","voice":"bewicks-wren"}'
   ```

## What to expect

Warm, end to end through the site: **~0.5 s** (0.05 s to render, 0.4 s for the
Viterbi decode that produces the honest accuracy number, plus network).

The free tier **sleeps when idle**. The first request after a nap pays a
container start plus the torch import and the three template banks — tens of
seconds. `/api/encode` waits up to 90 s rather than failing into a retry, but a
visitor who arrives cold will watch the button spin. That is the cost of the
free tier; a small always-on host removes it and nothing else changes.

Rate limiting lives in the Next route (10/min per IP), not here.

## Regenerating the motifs

Run `python service/freeze_motifs.py` **locally**, where `data/` and the feature
caches are, then re-run `build_space.sh` and push. Do this whenever a checkpoint
changes, or a species' band, window or clip selection changes — anything that
moves the shape library moves the motifs, and a stale bank is a voice that no
longer matches the site's pre-rendered audio.

## Files

| | |
|---|---|
| `freeze_motifs.py` | writes `motifs.json`; needs the corpus, run locally |
| `preload.py` | fills ml/'s caches from the motifs, then arms the tripwire |
| `app.py` | Gradio UI at `/` plus `POST /encode` and `GET /health`; warms all three at startup |
| `build_space.sh` | assembles `dist/space` from this repo |
| `SPACE_README.md` | becomes the Space's own README (its YAML header selects the SDK) |

## Python version

The checkpoints were rendered on Python 3.9.6, and Gradio 6 requires 3.10+, so
the Space runs a newer interpreter than this repo's `.venv`. That was checked
rather than hoped: with the same `torch`/`numpy`/`scipy` pins, Python 3.9.6 and
3.12.14 produce **byte-identical WAVs** for all three voices. The pins are what
hold the audio still, not the interpreter.
