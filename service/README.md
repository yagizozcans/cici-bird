# service/ — the hosted encoder

Live encoding needs torch, the three checkpoints and a motif library. The site
deploys `website/` to Vercel alone, and torch is ~200 MB against a 250 MB
function limit, so the encoder runs here instead and `/api/encode` proxies to
it. Same `encode_once.encode` on both sides — there is one renderer, and the
transport is the only difference between a local clip and a hosted one.

It deploys as a **Gradio Space**, so there is no Dockerfile: Hugging Face
installs `requirements.txt` and runs `app.py` itself.

**The platform owns the server.** An earlier version mounted FastAPI, served a
plain `POST /encode`, and ran its own uvicorn — which died on the Hub with
"[Errno 98] address already in use", because the Gradio runtime has already
bound 7860 by the time `app.py` runs. So `app.py` is now the canonical shape
(build `demo`, call `demo.launch()`), and the site reaches it through Gradio's
own API at `/gradio_api/call/encode_json`: a POST returning an `event_id`, then
a streaming GET carrying the result. `viaService` in the Next route does both
and parses the SSE.

There are two functions behind it. `encode` drives the visible demo, so the
Space is a page someone can try. `encode_json` returns the exact payload the
site needs, wired to hidden components purely to give it an `api_name`.

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

1. **Create the Space.** On huggingface.co: *New* → *Space*, SDK **Gradio**.
   No Docker involved.

   **Leave the hardware alone.** On the free tier, Gradio Spaces run on
   ZeroGPU — "Subscribe to PRO for unlocking free cpu-basic flavor" — so
   cpu-basic is not selectable, and a Space created on ZeroGPU cannot be
   downgraded later without PRO either. That is fine here: ZeroGPU instances
   are CPU machines that attach a GPU only when a `@spaces.GPU` function is
   called, and this app never defines one. `_load_net` maps to cpu and both
   synth passes are plain tensor math.

   The one thing ZeroGPU does impose is a **torch allowlist, checked against
   the text of requirements.txt** — which is why the pin there is plain
   `torch==2.8.0` and not `2.8.0+cpu`. See that file for why the CPU wheel
   still lands. A Space stuck on this reports stage `CONFIG_ERROR` and names
   torch; no hardware is allocated and nothing is billed while it sits there.

   If Docker appears as a selectable SDK on your account with cpu-basic
   available, that is the tidier target — the restriction quoted above is
   specific to Gradio Spaces. This directory deploys equally well either way;
   only the Space metadata differs.

2. **Assemble, then sync into a clone of the Space.** The Space directory is
   built, never hand-maintained — it is a copy of the files the encoder
   imports, laid out the way this repo lays them out so `generate_audio.py`'s
   `parents[2]` still resolves.

   Clone the Space rather than `git init`-ing a new repo: the Hub seeds a new
   Space with its own commit (a README and a `.gitattributes`), so a fresh
   history is *unrelated* to it and the push is rejected with "fetch first".

   ```bash
   ./service/build_space.sh                  # writes dist/space (gitignored)
   cd dist
   git clone https://huggingface.co/spaces/<you>/<space> space-repo
   rsync -a --exclude .git space/ space-repo/
   cd space-repo && git add -A && git commit -m "cici bird encoder" && git push
   ```

   `--exclude .git` matters: without it you would copy over the clone's own
   repository and lose the remote.

   Re-run those four lines to redeploy; the clone already has the right history,
   so `rsync && git add -A && git commit && git push` is the whole update loop.

   **git-lfs is required.** The Hub rejects binary files pushed through plain
   git *at any size* — not just above the 10 MB LFS threshold, which is a
   different rule — so the three 556 KB checkpoints have to go through LFS or
   the push dies in the pre-receive hook naming them. `build_space.sh` writes
   the `.gitattributes` for it; install the tool once:

   ```bash
   brew install git-lfs && git lfs install
   ```

   Install it *before* the first `git add`, since that is when the filter turns
   the checkpoints into pointers. If a plain-git commit already exists, delete
   `dist/space-repo` and redo step 2 rather than trying to rewrite it.

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
caches are, then re-run `build_space.sh` and the sync loop in step 2. Do this whenever a checkpoint
changes, or a species' band, window or clip selection changes — anything that
moves the shape library moves the motifs, and a stale bank is a voice that no
longer matches the site's pre-rendered audio.

## Files

| | |
|---|---|
| `freeze_motifs.py` | writes `motifs.json`; needs the corpus, run locally |
| `preload.py` | fills ml/'s caches from the motifs, then arms the tripwire |
| `app.py` | the Gradio demo, the `encode_json` API, and the ZeroGPU marker; warms all three at import |
| `build_space.sh` | assembles `dist/space` from this repo, incl. its `.gitattributes` |
| `SPACE_README.md` | becomes the Space's own README (its YAML header selects the SDK) |

## Python version

The checkpoints were rendered on Python 3.9.6, and Gradio 6 requires 3.10+, so
the Space runs a newer interpreter than this repo's `.venv`. That was checked
rather than hoped: with the same `torch`/`numpy`/`scipy` pins, Python 3.9.6 and
3.12.14 produce **byte-identical WAVs** for all three voices. The pins are what
hold the audio still, not the interpreter.
