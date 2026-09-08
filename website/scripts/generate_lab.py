"""
Generate the data behind a Lab entry: every letter of a trained voice's
alphabet, measured as the model actually sings it.

WHY THIS SCRIPT EXISTS
----------------------
The Lab's "voice space" plots each letter on attributes of its motif — how fast
the note sweeps, how long it lasts, what pitch it was assigned, how bright the
model renders it. None of that exists on the website: ml/generate_species.py
computes it while singing a message and throws it away, and the audio manifest
only carries per-letter TIMING (cues). This script measures the attributes once
and writes them to src/data/lab/, where the site imports them as typed JSON —
the same arrangement as public/audio/manifest.json, for the same reason: no
figure on the page is hand-maintained.

THE CHECKPOINT CONTRACT
-----------------------
The points are not properties of the species. They are properties of ONE
checkpoint: the motif each letter borrows is chosen from a library the model's
own feature cache defines, and brightness is measured on audio the model
rendered. So the file records its checkpoint, and by default it takes that
checkpoint FROM THE MANIFEST — the one the site's audio was rendered with. A
file measured against a different checkpoint than the audio it is synced to
would light up points that describe notes nobody is hearing. Regenerate this
after `npm run audio` whenever the trained checkpoint changes; the loader in
src/data/lab.ts refuses to render a mismatch, and scripts/check-launch.mjs
reports a stale file before the build gets that far.

Run:  cd website && ../.venv/bin/python scripts/generate_lab.py
      (torch lives in the project venv; system python3 will not have it)

With no --species it measures EVERY trained voice in the manifest, because
that is what "regenerate after npm run audio" has to mean once the Lab holds
more than one bird — a per-bird default would silently leave the others stale.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine"
ML = ROOT / "ml"
MANIFEST = ROOT / "website" / "public" / "audio" / "manifest.json"
OUT_DIR = ROOT / "website" / "src" / "data" / "lab"

sys.path.insert(0, str(ENGINE))
sys.path.insert(0, str(ML))
# The ml/ modules resolve their feature caches and checkpoints relative to the
# working directory, exactly as they do when run from ml/ by hand.
os.chdir(ML)

import birdsong_codec as codec  # noqa: E402
import species as SP  # noqa: E402
from config import HOP, SAMPLE_RATE  # noqa: E402
import generate_species as G  # noqa: E402

ALPHABET = codec.ALPHABET


def pearson(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.corrcoef(a, b)[0, 1])


def species_bird(key: str, slug: str, ckpt: Path) -> SimpleNamespace:
    """A bird whose messages are sequenced by ml/generate_species.py."""
    sp = SP.get(key)
    net = G.load_net(str(ckpt))
    s = G.settings(sp)
    return SimpleNamespace(
        key=key, slug=slug, name=sp.name, band=[sp.fmin, sp.fmax], win=sp.win,
        base=s["base"], step=s["step"], source="ml/generate_species.py",
        lib=G.shape_library(sp), assign=G.motif_assignment(sp),
        note_for=lambda ch: G.note_for(sp, ch),
        symbol_freq=lambda ch: G.symbol_freq(sp, ch),
        render=lambda f0, loud: G.render_contour(f0, loud, net),
    )


def wren_bird(key: str, slug: str, ckpt: Path) -> SimpleNamespace:
    """The Bewick's wren, which predates the species registry.

    Its motifs, frequency map and renderer live in ml/generate.py rather than
    generate_species.py, and its shape library comes from the old unkeyed
    feature_cache.npz. That is a difference in WHERE the notes come from, not
    in what is being measured, so it is adapted to the same shape here and
    measured by the same code — a second copy of the measurement would be a
    second thing to keep true.

    `win` is None deliberately: that cache stores f0, loudness and audio and
    no analysis window, so the honest answer is that this file does not know
    it. Every other bird records the window its species entry declares.
    """
    import generate as W  # noqa: E402  (ml/generate.py, wren-only)

    sp = SP.get(key)
    net = W._load_net(str(ckpt))
    return SimpleNamespace(
        key=key, slug=slug, name=sp.name, band=[sp.fmin, sp.fmax], win=None,
        base=W._GEN_BASE_FREQ, step=W._GEN_FREQ_STEP, source="ml/generate.py",
        lib=W._build_shape_library(), assign=W._motif_assignment(),
        note_for=W._note_for_symbol,
        symbol_freq=lambda ch: W._GEN_SYMBOL_TO_FREQ[ch],
        render=lambda f0, loud: W._render(f0, loud, net),
    )


BIRDS = {"bewicks_wren": wren_bird}   # everything else uses species_bird


def measure(bird, points: int) -> list[dict]:
    """One row per letter. The numerics mirror the measurement that chose the
    axes in the first place; change them and the method text goes stale."""
    lib, assign = bird.lib, bird.assign
    if len(set(assign.values())) != len(assign):
        raise SystemExit("motif assignment is not unique — the decoder cannot "
                         "separate two letters that share a shape")
    frame_rate = SAMPLE_RATE / HOP
    base, step = bird.base, bird.step
    pad = 20
    zeros = np.zeros(pad, dtype=np.float32)

    rows = []
    for i, ch in enumerate(ALPHABET):
        idx = assign[ch]
        _, _, mean_f0 = lib[idx]
        f0, ls = bird.note_for(ch)
        n = len(f0)
        t = np.arange(n) / frame_rate

        pitch = bird.symbol_freq(ch)
        if abs(pitch - (base + i * step)) > 1e-6:
            raise SystemExit(f"{ch!r}: symbol_freq {pitch} is not base + i*step")

        slope = float(np.polyfit(t, f0, 1)[0])

        # Render THIS note the way message_to_contour does (0.28 x loudness,
        # silence either side) and measure the result — brightness describes
        # what the model voices, not the recording the shape came from.
        #
        # The synth's noise branch draws from torch's global RNG (ml/synth.py),
        # so an unseeded render moves brightness and flatness by a few tenths
        # of a percent every run. Seeding per LETTER, not once per bird, keeps
        # each row the same whether it was measured alone or in a batch.
        torch.manual_seed(i)
        audio = bird.render(np.concatenate([zeros, f0, zeros]),
                            np.concatenate([zeros, 0.28 * ls, zeros]))
        seg = audio[pad * HOP:(pad + n) * HOP]
        mag = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
        freqs = np.fft.rfftfreq(len(seg), 1 / SAMPLE_RATE)
        bright = float((mag * freqs).sum() / (mag.sum() + 1e-12))
        flat = float(np.exp(np.mean(np.log(mag + 1e-12))) / (np.mean(mag) + 1e-12))

        sample = np.round(np.linspace(0, n - 1, points)).astype(int)
        row = dict(
            ch=ch, idx=int(idx),
            pitch=round(float(pitch), 1),
            dur=round(n / frame_rate * 1000, 1),
            slope=round(slope, 1),
            span=round(float(f0.max() - f0.min()), 1),
            bright=round(bright, 1),
            flat=round(flat, 4),
            transplant=round(abs(float(mean_f0) - pitch), 1),
            f0=[round(float(v), 1) for v in f0[sample]],
            env=[round(float(v), 3) for v in ls[sample] / (ls.max() + 1e-12)],
        )
        for k, v in row.items():
            vals = v if isinstance(v, list) else [v]
            if any(isinstance(x, float) and not np.isfinite(x) for x in vals):
                raise SystemExit(f"{ch!r}: non-finite {k}")
        rows.append(row)
    return rows


def one(a, manifest: dict, key: str) -> None:
    """Measure one bird and write its file."""
    slug = a.slug or key.replace("_", "-")
    voice = manifest.get("trainedVoices", {}).get(slug)
    if voice is None:
        raise SystemExit(f"{slug}: no trained voice in {MANIFEST.relative_to(ROOT)} "
                         f"— the Lab only plots voices the site actually plays")

    checkpoint = a.checkpoint or voice["model"]
    matches = checkpoint == voice["model"]
    if not matches and not a.allow_checkpoint_mismatch:
        raise SystemExit(
            f"checkpoint {checkpoint} is not the manifest's {voice['model']}. "
            f"The audio on the site was rendered with the manifest's; measuring "
            f"a different one gives points that describe notes nobody hears. "
            f"Pass --allow-checkpoint-mismatch if that is what you want.")
    ckpt_path = ROOT / checkpoint
    if not ckpt_path.is_file():
        raise SystemExit(f"no such checkpoint {checkpoint}")

    print(SP.banner(SP.get(key)))
    bird = BIRDS.get(key, species_bird)(key, slug, ckpt_path)
    rows = measure(bird, a.points)
    if len(rows) != len(ALPHABET):
        raise SystemExit(f"{len(rows)} rows for {len(ALPHABET)} symbols")

    col = lambda k: np.array([r[k] for r in rows])  # noqa: E731
    meta = dict(
        species=bird.name, key=bird.key, speciesSlug=slug,
        checkpoint=checkpoint, checkpointMatchesManifest=matches,
        manifestGeneratedAt=manifest["generatedAt"],
        generatedAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        generator="website/scripts/generate_lab.py",
        source=bird.source,
        band=bird.band, win=bird.win,
        libNotes=len(bird.lib),
        base=bird.base, step=bird.step,
        sampleRate=SAMPLE_RATE, frameRate=round(SAMPLE_RATE / HOP, 3),
        nLetters=len(rows), points=a.points,
        correlations=dict(
            pitchBright=round(pearson(col("pitch"), col("bright")), 3),
            pitchDur=round(pearson(col("pitch"), col("dur")), 3),
            pitchSlope=round(pearson(col("pitch"), col("slope")), 3),
            durSlope=round(pearson(col("dur"), col("slope")), 3),
        ),
    )

    out = Path(a.out) if a.out else OUT_DIR / f"{slug}-voice-space.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    # Sorted keys and compact separators so a regeneration that changes
    # nothing produces a file that differs only in `generatedAt`, and one
    # that does shows a readable diff.
    out.write_text(json.dumps(dict(meta=meta, letters=rows),
                              separators=(",", ":"), sort_keys=True) + "\n")
    c = meta["correlations"]
    print(f"wrote {out.relative_to(ROOT)}  ({out.stat().st_size:,} bytes)")
    print(f"  {len(rows)} letters, {meta['libNotes']} library notes, "
          f"checkpoint {checkpoint}")
    print(f"  r  pitch~bright {c['pitchBright']:+.2f}  pitch~dur {c['pitchDur']:+.2f}  "
          f"pitch~slope {c['pitchSlope']:+.2f}  dur~slope {c['durSlope']:+.2f}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--species", default=None,
                    help="ml species key (see ml/species.py); default: every "
                         "trained voice in the manifest")
    ap.add_argument("--slug", default=None,
                    help="website species slug; default: key with '-' for '_'")
    ap.add_argument("--checkpoint", default=None,
                    help="root-relative .pt path; default: the manifest's "
                         "trainedVoices[slug].model")
    ap.add_argument("--allow-checkpoint-mismatch", action="store_true",
                    help="measure a checkpoint the audio was NOT rendered with "
                         "(for experiments; the site will refuse the file)")
    ap.add_argument("--points", type=int, default=32,
                    help="contour samples per letter (page weight, not fidelity)")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    if a.species:
        keys = [a.species]
    else:
        # The manifest is keyed by website slug; the ml registry by key.
        keys = [s.replace("-", "_") for s in manifest.get("trainedVoices", {})]
        if not keys:
            raise SystemExit("no trained voices in the manifest — nothing to measure")
        for flag in ("slug", "checkpoint", "out"):
            if getattr(a, flag):
                raise SystemExit(f"--{flag} names one file; pass --species too")
    for key in keys:
        one(a, manifest, key)


if __name__ == "__main__":
    main()
