# CLAUDE.md — Birdsong / Ambient

> **Mode: Andrej Karpathy**
> Build like you teach. Understand every line you write. No magic, no bloat.

This file instructs Claude how to work in this repo. Follow it over defaults.

---

## 1. First Principles

We are building generative audio. Audio is unforgiving — you can *hear* every mistake. That demands first-principles understanding.

- **Understand before you abstract.** Do not wrap what you don't deeply understand. If you can't explain it on a whiteboard character-by-character, you shouldn't code it.
- **Simple is better than clever.** The best code is 80 lines that anyone can read, not 400 lines with 6 abstractions. `ml/model.py:29` is ~50 lines and does everything. That's the target.
- **No hype.** Don't call it "AI-powered" or "revolutionary." Call it what it is: `harmonic_synth + filtered_noise` driven by a GRU predicting amplitudes. Be literal.
- **Reproduce, then improve.** Never claim an improvement without a reproducible number. `ml/train.py:135` fingerprints the feature cache for a reason — invisible cache bugs kill science.

## 2. How to Work

### Think before coding

Before any change, state:
1. What is the goal in one sentence? What is the verifiable success criterion?
2. What are your assumptions? What could be wrong?
3. Is there a simpler way that doesn't require new code?

If multiple interpretations exist, **ask**. Don't silently pick one.

### The Karpathy Loop

For every feature/fix, transform it into a verifiable loop:

```
1. [Step] -> verify: [how you will check it]
2. [Step] -> verify: [how you will check it]
3. [Step] -> verify: [how you will check it]
```

Examples:
- "Add validation" -> "Write a test for invalid inputs, make it pass"
- "Fix bug" -> "Write a script that reproduces it, fix, re-run"
- "Improve model" -> "Run baseline, change one thing, measure val loss on same split"

Do not batch 5 changes and hope. One change, one measurement.

### Seed Everything, Keep Splits Fixed

- `SPLIT_SEED = 1234` and `SUBSET_SEED = 4321` in `ml/train.py:65` exist so every run sees the same split. Never reshuffle per run.
- `torch.manual_seed`, `np.random.default_rng(seed)` — seed all RNG. `ml/generate.py:229` seeds per-symbol for deterministic motifs. Follow that pattern.
- Fingerprint every cache. If value depends on checkpoint, checkpoint is in key (`ml/generate.py:406` `_NETS/_BANKS`).

## 3. Code Style — Simplicity First

- **Minimum code that solves the problem.** No speculative features, no "flexibility" or "configurability" that wasn't requested.
- **No abstractions for single-use code.** If it's used once, keep it inline.
- **Match existing style, even if you'd do it differently.** This repo uses lowercase with underscores, long honest docstrings explaining *measured* tradeoffs (`ml/generate.py:8`), no type-hint bloat.
- **Comment the WHY with numbers, not the WHAT.** Good: `ml/generate.py:82` "22ms still sits right at the real 20ms median, so this costs no audible realism." Bad: `# loop through notes`.
- **If you write 200 lines and it could be 50, rewrite it.** Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 4. Surgical Changes

- Touch only what you must. Every changed line must trace directly to the user's request.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Clean up only your own mess: remove imports/vars/functions YOUR change made unused. Don't delete pre-existing dead code — mention it instead.

## 5. Project-Specific Constraints

Learned the hard way — respect them:

**Audio**
- `SAMPLE_RATE = 22050` everywhere (`ml/config.py:13`, `engine/birdsong_codec.py:28`). Never resample ad-hoc. One source of truth: `ml/config.py`.
- `HOP = 64`, `FRAME_RATE = 250` (`ml/config.py:22`). Control rate vs audio rate must align. If you change one, you invalidate caches and templates.
- `DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"` (`ml/config.py:26`). Test on both.

**DDSP Model (`ml/model.py`, `ml/synth.py`)**
- `DDSPDecoder` does NOT predict pitch. Pitch (`f0`) comes from data and drives the oscillator directly (`ml/synth.py:70`). The net only predicts `amplitude + harmonic_distribution + noise_magnitudes`. Don't break this contract.
- `n_in = 2` (f0+loudness) vs `n_in = 3` (f0+loudness+centroid). Old checkpoints are `n_in=2`. Loader infers from weights (`ml/generate.py:424`), don't hardcode.
- `harmonic_synth` is physics, not learned. It's differentiable so gradients flow *through* it. Never make it learnable.
- Training loss is `multiscale_spectral_loss` (`ml/loss.py:31`, FFT sizes [2048..64]), not waveform L2. Waveform L2 is perceptually meaningless (phase differences).

**Feature Extraction (`ml/data.py`, `ml/species.py`)**
- Pitch band is per-species (`species.py:51`), not global. Copying wren's `500-9000` to a new bird silently breaks f0 tracking. Measure with `data.py --measure-band` before training any new species/category.
- Window size is per-species (`species.py:60`). Wren/sparrow/cardinal use `win=256`; older checkpoints used `1024`. Fingerprint includes `win` (`ml/train.py:150`).
- Cache is keyed by `v3|key|n_clips|band|win|...` (`ml/train.py:150`). A stale cache looks like a hit but trains on wrong data. Never bypass the fingerprint.

**Birdsong Codec (`engine/birdsong_codec.py`, `ml/generate.py`)**
- Codec protocol (symbol->frequency) and voice (timbre) are separate concerns. `birdsong_codec.py` owns protocol, `ml/model.py+synth.py` owns voice. Keep them decoupled.
- Fixed motifs + Viterbi decoding (`ml/generate.py:8`) exists because pitch estimation fails (224Hz median error vs 60Hz budget) and gaps only hit -13.3dB not -46dB. Don't reintroduce mean-pitch decoding or energy segmentation.
- Gaps and pauses are contract: `INTER_NOTE_GAP_RANGE = (0.022, 0.055)` `WORD_PAUSE_RANGE = (0.10, 0.20)`. Encoder and decoder must agree. Off-by-3 column lag (`_COL_LAG`) is real — don't ignore STFT windowing.

**Ambient Pivot — Current Truth**
- DDSP as built is for **tonal, harmonic** audio (birds). It fails for transients (footsteps, barks) and stochastic textures (rain, wind) — see YC memo. Do not pretend it works. Any ambient work that is not tonal requires a different primitive (diffusion/transformer), not `harmonic_synth`.
- "One model per ambient category" scales via `species.py` registry technically, but each needs 200+ clean clips + measured band + tuning. That's linear human cost, not a moat. Prefer unified foundation model for ambient.

## 6. Verification Before Done

Never say "done" without evidence:

- Run the thing. `python ml/train.py overfit` must hit low loss if model has capacity. `python ml/generate.py "hello" && python ml/generate.py` decode must round-trip >95%.
- Listen. Generate `out/wren_message.wav` and `out/synth_test.wav` — ears catch what loss hides.
- Check val loss, not train loss. Best checkpoint is best val (`ml/train.py:333`), not last epoch.
- For decoding changes, sweep on 8 messages and **check on 10 held-out messages** (`ml/generate.py:506`). No plateau hunting.
- `python ml/data.py --species <key> --measure-band` before trusting any new bird/category.

## 7. Anti-Patterns — Don't Do These

- Don't add a dependency to avoid writing 10 lines. Prefer `numpy/scipy/torch` already in repo.
- Don't create `utils/helpers/common.py` graveyards. Keep code where it's used.
- Don't add config files for one-off numbers. Constants live at top of file where they are used, with measured justification in comments.
- Don't add error handling for impossible scenarios. Handle the real failure modes (wrong sample rate, missing wav, stale cache).
- Don't "optimize" without a flamegraph. DDSP is already fast; bottlenecks are feature extraction and ISTFT.
- Don't hide uncertainty. If you're not sure whether rain needs diffusion vs filtered noise, say so and propose an experiment.

## 8. When You Notice Something Broken Nearby

Mention it. Don't fix it silently.

Example: "Note: `species.py` marks `northern_mockingbird` band as unverified — any model trained on it will have wrong f0. Should I measure it?"

---

**In short:** Think deeply, build minimally, measure honestly, keep it simple enough to teach. If you can't explain the spectrogram, you don't understand the model.
