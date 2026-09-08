"""
Derive a species' DECODE constants — margin, penalty, veto, threshold.

    ../.venv/bin/python calibrate_species.py --species northern_cardinal \
        --checkpoint checkpoints/cardinal_best250.pt

WHY THIS EXISTS SEPARATELY FROM calibrate.py

calibrate.py imports `generate` — the wren-only module — so it scores whatever
species' clips you point it at using the WREN's motif templates. It takes a
--species flag, which makes that easy to miss. This one goes through
generate_species and keys everything by (species, checkpoint).

WHY EVERY NUMBER HERE BELONGS TO A CHECKPOINT, NOT AN ALGORITHM

The templates the decoder matches against are RENDERED BY THE MODEL. Swap the
model and every template changes, so every score changes. A threshold is a
property of the algorithm PLUS the model, valid only for the pair.

TWO PHASES, because they answer different questions:

  sweep      margin/penalty/veto are decoder BEHAVIOUR: they trade off inventing
             letters against dropping them. Chosen on tuning messages, then
             checked on messages the sweep never saw — otherwise the reported
             accuracy is the accuracy of a setting chosen because it flattered
             this particular audio.

  threshold  separates "a real bird" from "a real message", and is calibrated
             over the ENTIRE wild corpus, never a sample. Detectors live and die
             on the tail: the sparrow's running maximum sat at +0.0971 for 400
             clips and jumped to +0.1442 at clip 500. A 100-clip calibration
             would have set a threshold BELOW the true wild maximum and called
             that clip a message.
"""

import argparse
import glob
import itertools
import os
import sys
import time

import numpy as np
import soundfile as sf

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "engine"))

import birdsong_codec as codec
import generate_species as G
import species as SP
from eval_checkpoint import MESSAGES

# Tuning and held-out messages are disjoint, and generated with different seeds
# from the ones the threshold phase uses, so no phase is ever measured on audio
# another phase was fitted to.
TUNE, HELD = MESSAGES[:15], MESSAGES[15:]


def score_messages(texts, sp, ck, seed0, margin, penalty, veto):
    accs, scores = [], []
    for i, m in enumerate(texts):
        audio, clean = G.generate(m, sp.key, ck, seed=seed0 + i)
        text, s = G.decode(audio, sp.key, ck, margin=margin, penalty=penalty,
                           veto=veto, return_score=True)
        accs.append(codec.edit_distance_accuracy(clean, text))
        scores.append(s)
    return np.array(accs), np.array(scores)


def sweep(sp, ck, grid):
    print(f"\nSWEEP — {len(grid)} settings x {len(TUNE)} tuning messages")
    print(f"{'margin':>7} {'penalty':>8} {'veto':>6} {'accuracy':>10}")
    rows = []
    for mrg, pen, vet in grid:
        accs, _ = score_messages(TUNE, sp, ck, 100, mrg, pen, vet)
        rows.append((float(accs.mean()), mrg, pen, vet))
        print(f"{mrg:7.2f} {pen:8.1f} {vet:6.2f} {100*accs.mean():9.1f}%", flush=True)
    # PICK THE MIDDLE OF THE WINNING REGION, NOT THE FIRST ROW.
    #
    # sort(reverse=True) on (accuracy, margin, penalty, veto) breaks ties by the
    # VALUES, so when a grid is flat — which is exactly what happened on the
    # cardinal, 100% at all 27 points — it returns the largest-valued corner and
    # labels it "best". That is a tie-break masquerading as a measurement, and a
    # corner is the worst place to sit: it is the point with the least room
    # before the untested region. Among everything tied at the top, take the
    # per-axis MEDIAN, which is the centre of the region the sweep showed to be
    # safe. When one setting genuinely wins, it is the only tied row and this
    # reduces to picking it.
    top = max(r[0] for r in rows)
    tied = [r for r in rows if r[0] >= top - 1e-12]
    mrg = float(np.median([r[1] for r in tied]))
    pen = float(np.median([r[2] for r in tied]))
    vet = float(np.median([r[3] for r in tied]))
    acc = top
    spread = 100 * (top - min(r[0] for r in rows))
    print(f"\n{len(tied)}/{len(rows)} settings tied at the top accuracy")
    print(f"chosen (per-axis median of the tied set): margin {mrg}  penalty {pen}  "
          f"veto {vet}   tuning {100*acc:.1f}%")
    verdict = ("a broad plateau — the exact values matter little" if spread < 3
               else "NOT flat — these values are load-bearing, re-sweep on any change")
    print(f"grid spread {spread:.1f}pp  ({verdict})")

    h_acc, _ = score_messages(HELD, sp, ck, 200, mrg, pen, vet)
    print(f"held-out ({len(HELD)} messages the sweep never saw): {100*h_acc.mean():.1f}%"
          f"   perfect {(h_acc == 1.0).sum()}/{len(h_acc)}  worst {100*h_acc.min():.1f}%")
    gap = 100 * (acc - h_acc.mean())
    print(f"tuning-to-held-out gap {gap:+.1f}pp"
          f"{'  (small — the setting generalises)' if abs(gap) < 3 else '  (LARGE — overfitted to the tuning set)'}")
    return mrg, pen, vet


def threshold(sp, ck, mrg, pen, vet):
    paths = sorted(glob.glob(os.path.join(sp.clips_dir, "*.wav")))
    print(f"\nTHRESHOLD — scoring {len(paths)} wild {sp.name} recordings")
    wild, t0 = [], time.time()
    for i, p in enumerate(paths, 1):
        a, _ = sf.read(p)
        _, s = G.decode(np.ascontiguousarray(a, dtype=np.float32), sp.key, ck,
                        margin=mrg, penalty=pen, veto=vet, return_score=True)
        wild.append(s)
        if i % 100 == 0:
            print(f"  {i}/{len(paths)}  ({time.time()-t0:.0f}s)  "
                  f"running max {max(wild):+.4f}", flush=True)
    wild = np.array(wild)

    print(f"\nscoring {len(MESSAGES)} generated messages ...")
    accs, msg = score_messages(MESSAGES, sp, ck, 900, mrg, pen, vet)

    lo, hi = wild.max(), msg.min()
    print(f"\nwild    : max {lo:+.4f}  mean {wild.mean():+.4f}  "
          f"p99 {np.quantile(wild, 0.99):+.4f}  n={len(wild)}")
    print(f"messages: min {hi:+.4f}  mean {msg.mean():+.4f}  n={len(msg)}")
    print(f"decode  : mean {100*accs.mean():.2f}%  "
          f"perfect {(accs == 1.0).sum()}/{len(accs)}  worst {100*accs.min():.1f}%")
    if hi <= lo:
        print(f"\nPOPULATIONS OVERLAP by {lo-hi:+.4f} — NO threshold separates them.")
        print("Do not ship a detector for this checkpoint.")
        return None
    thr = (lo + hi) / 2
    print(f"\nseparable. threshold = {thr:.3f}   margin +/- {(hi-lo)/2:.4f}")
    print(f"  false positives {(wild >= thr).sum()}/{len(wild)}   "
          f"missed {(msg < thr).sum()}/{len(msg)}")
    return thr


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--phase", default="both", choices=["sweep", "threshold", "both"])
    ap.add_argument("--margin", type=float); ap.add_argument("--penalty", type=float)
    ap.add_argument("--veto", type=float)
    SP.add_argument(ap)
    a = ap.parse_args()
    sp = SP.get(a.species)
    print(SP.banner(sp)); print(f"checkpoint: {a.checkpoint}")

    mrg, pen, vet = a.margin, a.penalty, a.veto
    if a.phase in ("sweep", "both"):
        grid = list(itertools.product([0.40, 0.48, 0.56], [1.0, 2.0, 3.0],
                                      [0.0, 0.20, 0.40]))
        mrg, pen, vet = sweep(sp, a.checkpoint, grid)
    if a.phase in ("threshold", "both"):
        if None in (mrg, pen, vet):
            raise SystemExit("--phase threshold needs --margin/--penalty/--veto")
        thr = threshold(sp, a.checkpoint, mrg, pen, vet)
        if thr is not None:
            print(f"\n-> SETTINGS[{sp.key!r}]: margin={mrg}, penalty={pen}, "
                  f"veto={vet}, threshold={thr:.3f}")
