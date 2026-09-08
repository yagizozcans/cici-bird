# CICI BIRD

Encode a text message as synthesized birdsong, transmit it as audio, decode it
back to text. Three of the voices are DDSP models trained on real recordings of
that species; the rest are hand-tuned parametric profiles.

Nothing here is AI-powered in the brochure sense. The voice is
`harmonic_synth + filtered_noise` driven by a ~140k-parameter GRU that predicts
amplitude, harmonic distribution and noise magnitudes. Pitch is not predicted —
it comes from the data and drives the oscillator directly.

## Layout

| Path | What it is |
|---|---|
| `engine/` | The **protocol** — symbol → frequency, the fixed-grid codec, parametric voices |
| `ml/` | The **voice** — DDSP model, training, feature extraction, message generation and Viterbi decoding |
| `website/` | cicibird.com (Next.js). Ships pre-rendered audio built from `ml/` |
| `docs/` | Product and site specs (`overview.md`, `app.md`, `website.md`) |
| `ml/checkpoints/` | Trained weights. `wren.pt`, `sparrow_win256.pt`, `cardinal_best250.pt` are the three the site ships |

Protocol and voice are deliberately decoupled: `engine/birdsong_codec.py` owns
which frequency a letter is, `ml/model.py` + `ml/synth.py` own what that
frequency sounds like.

## Setup

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

`ml/` scripts resolve `checkpoints/...` relative to the working directory, so
run them from `ml/`:

```bash
cd ml && python generate.py "hello world"
```

## What is NOT in this repo

- **`data/`** — 3.6 GB of wild recordings. Not ours to redistribute.
- **`ml/feature_cache*.npz`** — ~380 MB of extracted features, rebuilt by
  `ml/train.py`. They are fingerprinted (`v3|key|n_clips|band|win|...`) so a
  missing cache is safe and a stale one is not. A committed cache is a stale
  cache.
- **`ml/out/`, `engine/out/`** — generated audio and run logs. Reproduce them.

So a fresh clone can generate messages and run the website (checkpoints and the
site's audio assets are committed), but cannot retrain without the dataset.
