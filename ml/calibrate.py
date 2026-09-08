"""
Re-measure the message-detector threshold for a checkpoint.

    ../.venv/bin/python calibrate.py checkpoints/wren.pt

WHY THIS MUST BE RE-RUN FOR EVERY NEW MODEL:

`_MESSAGE_THRESHOLD` in generate.py separates "a real bird" from "a real
message" using the whole-signal Viterbi score. But the motif templates that
score is computed against are RENDERED BY THE MODEL. Swap the model and every
template changes, so every score changes, so the threshold that used to sit in
the empty band between the two populations may no longer sit in it at all.

A threshold is not a property of the algorithm — it is a property of the
algorithm PLUS the particular model, and it is only valid for the pair. Copying
a new checkpoint into place without re-running this leaves a number that looks
authoritative and is quietly wrong.

Measured over ALL wild clips, never a sample: the first version of this
threshold was set from 20 clips (max +0.01, threshold 0.06) and the full 222
then revealed a tail to +0.066 — already inside the threshold. Detectors live
and die on the tail of the distribution, and a small sample is exactly where a
tail hides.
"""

import argparse
import glob
import os
import sys

import numpy as np
import soundfile as sf

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "engine"))

import generate as G
import birdsong_codec as codec
import species as SP
from eval_checkpoint import MESSAGES


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("checkpoint", nargs="?", default="checkpoints/wren.pt")
    SP.add_argument(ap)
    args = ap.parse_args()
    ck = args.checkpoint
    sp = SP.get(args.species)
    print(SP.banner(sp))

    # The wild population must be the species the model was TRAINED on. Scoring
    # a wren model against robin recordings measures nothing about either.
    paths = sorted(glob.glob(os.path.join(sp.clips_dir, "*.wav")))
    print(f"scoring {len(paths)} wild recordings with {os.path.basename(ck)} ...")
    wild = []
    for i, p in enumerate(paths, 1):
        a, _ = sf.read(p)
        _, s = G.decode_natural(np.ascontiguousarray(a, dtype=np.float32),
                                checkpoint=ck, return_score=True)
        wild.append(s)
        if i % 50 == 0:
            print(f"  {i}/{len(paths)}")
    wild = np.array(wild)

    print(f"scoring {len(MESSAGES)} generated messages ...")
    msg, accs = [], []
    for i, m in enumerate(MESSAGES):
        audio, clean = G.generate(m, checkpoint=ck, seed=900 + i)
        text, s = G.decode_natural(audio, checkpoint=ck, return_score=True)
        msg.append(s)
        accs.append(codec.edit_distance_accuracy(clean, text))
    msg, accs = np.array(msg), np.array(accs)

    lo, hi = wild.max(), msg.min()
    thr = (lo + hi) / 2
    print(f"\nwild    : max {lo:+.4f}  mean {wild.mean():+.4f}  (n={len(wild)})")
    print(f"messages: min {hi:+.4f}  mean {msg.mean():+.4f}  (n={len(msg)})")
    print(f"decode  : mean {100*accs.mean():.2f}%  perfect {(accs==1.0).sum()}/{len(accs)}"
          f"  worst {100*accs.min():.1f}%")

    if hi <= lo:
        print(f"\nPOPULATIONS OVERLAP by {lo-hi:+.4f} — no threshold separates them.")
        print("Do NOT ship this checkpoint's detector without revisiting it.")
        return

    print(f"\nseparable. suggested _MESSAGE_THRESHOLD = {thr:.3f}")
    print(f"  margin below it (wild) {thr-lo:+.4f}   above it (messages) {hi-thr:+.4f}")
    print(f"  at this threshold: {(wild>=thr).sum()}/{len(wild)} wild false positives, "
          f"{(msg<thr).sum()}/{len(msg)} messages missed")
    print(f"\ncurrent value in generate.py: {G._MESSAGE_THRESHOLD}")
    if abs(G._MESSAGE_THRESHOLD - thr) > 1e-9:
        print("  -> UPDATE IT to the suggested value above.")


if __name__ == "__main__":
    main()
