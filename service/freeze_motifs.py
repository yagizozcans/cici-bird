#!/usr/bin/env python3
"""Freeze the 31 motifs each trained voice actually sings.

RUN THIS LOCALLY, where data/ and the feature caches are. It writes
service/motifs.json, which is the reason the hosted encoder does not need
either of them.

The shape library is ~1100-1600 real notes per species, extracted from the
corpus. But `motif_assignment` picks exactly one note per symbol and the choice
is deterministic (_MOTIF_SEED), so only 31 of those notes are ever sung. The
other ~1500 exist solely so the assignment has something to choose from — a
choice already made, and made the same way every time.

  corpus + feature caches   3.6 GB + 3 x 65 MB
  the 31 motifs that matter 182 KB

Verified equal, not assumed: with these motifs preloaded and the corpus and
feature caches made unreachable, all three voices render audio that is
BIT-IDENTICAL to the full-corpus path and still decode at 100%. Decoding works
too because the template bank is rendered from the motifs by the model, not
read from the corpus.

Regenerate whenever a checkpoint changes, or when a species' band, window or
clip selection changes — anything that moves the shape library moves the
motifs, and a stale bank is a voice that no longer matches the site's audio.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "engine"))
sys.path.insert(0, os.path.join(ROOT, "ml"))

import generate as wren                      # noqa: E402  (ml/generate.py)
import generate_species as gs                # noqa: E402
import species as SP                         # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "motifs.json")


def as_json(pairs, assign):
    """{symbol: [f0_shape, loudness_shape, mean_f0]}, in ALPHABET order."""
    return {ch: [pairs[i][0].tolist(), pairs[i][1].tolist(), float(pairs[i][2])]
            for ch, i in assign.items()}


def main():
    banks = {"bewicks_wren": as_json(wren._build_shape_library(),
                                     wren._motif_assignment())}
    for key in ("song_sparrow", "northern_cardinal"):
        sp = SP.get(key)
        banks[key] = as_json(gs.shape_library(sp), gs.motif_assignment(sp))

    with open(OUT, "w") as fh:
        json.dump(banks, fh, separators=(",", ":"))

    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.1f} KB)")
    for key, bank in banks.items():
        frames = sum(len(m[0]) for m in bank.values())
        print(f"  {key:18s} {len(bank)} motifs, {frames} frames")


if __name__ == "__main__":
    main()
