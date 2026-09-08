"""
Is this checkpoint actually BETTER? — the comparison harness.

    ../.venv/bin/python eval_checkpoint.py checkpoints/wren_v1_approved.pt checkpoints/wren_baseline.pt

WHY THIS EXISTS RATHER THAN JUST READING THE VALIDATION LOSS:

The training loss answers "how well does the model reconstruct REAL wren clips
when handed the f0/loudness extracted from those very clips?" That is a fine
training objective, but it is NOT our task. In generate.py the model is driven by
SYNTHETIC contours — borrowed motifs transplanted onto remapped frequencies,
strung together with gaps we invented. Nothing guarantees a better reconstructor
is a better generator; the two are different distributions of input.

So a checkpoint is judged on three things, in increasing order of what we
actually care about:

  1. val_loss        — reconstruction of held-out real clips (the training goal)
  2. decode accuracy — can messages rendered by this model be read back?
  3. detector gap    — does it still separate real birds from real messages?

Metric 3 needs re-measuring for EVERY checkpoint, not inherited. The motif
templates are RENDERED BY the model, so a new model means new templates, new
scores, and a new threshold. A number tuned against the old model is not
transferable evidence about the new one.
"""

import argparse
import glob
import os
import sys

import numpy as np
import soundfile as sf
import torch
from torch.utils.data import DataLoader, TensorDataset

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "engine"))

import generate as G
import birdsong_codec as codec
import species as SP
from train import load_cache, split_indices, evaluate, N_SAMPLES, VAL_FRACTION
from data import list_clips

# Held-out message set, fixed so every checkpoint is judged on the same texts.
#
# Sized at 30, not 12, from a measurement rather than a guess. With 12 messages
# the paired standard error on a decode-accuracy difference is large enough that
# a ~1pp change reads as significant when it is pure noise — which happened: a
# 12-message run said a retrained model was 1.4pp WORSE, and the same comparison
# on 30 messages said it was 1.1pp BETTER. Neither was real. Before trusting any
# comparison, check that the measurement can resolve the effect size you care
# about; a harness too small to detect your effect will still hand you a number.
MESSAGES = [
    "where are you right now", "the sun is going down", "call me when you get home",
    "happy birthday to you", "i miss you already", "what time is dinner",
    "the garden looks beautiful today", "dont forget your keys",
    "sing me another song", "we should go hiking this weekend",
    "see you tomorrow at the park", "thank you for everything",
    "i came here from a long way", "meet me by the river tonight",
    "good morning little bird", "lets go outside", "hello world how are you",
    "the nightingale sings at dusk", "please water the plants",
    "my favourite season is spring", "can you hear me singing",
    "the old oak by the gate", "we are running late again",
    "tell me a story tonight", "the sky turned orange today",
    "i found your letter", "come back when you can",
    "every morning the same song", "this is the last one", "winter is coming soon",
]


def val_loss_of(ckpt, sp, val_fraction=VAL_FRACTION, device="cpu"):
    """Reconstruction loss on this species' held-out clips.

    Only comparable between two checkpoints when BOTH are measured with the same
    --species and --val-fraction: a different corpus or a different split is a
    different exam, and the scores do not transfer.
    """
    f0, loud, cen, aud = load_cache(sp)
    _, va = split_indices(len(f0), val_fraction)
    loader = DataLoader(TensorDataset(f0[va], loud[va], cen[va], aud[va]),
                        batch_size=4)
    return evaluate(G._load_net(ckpt), loader, device)


def decode_quality(ckpt):
    """Per-message accuracies. Returned in full, not just averaged, so two
    checkpoints can be compared PAIRWISE on the same texts — a paired test
    cancels out the fact that some messages are simply harder than others, and
    detects a real difference far more sensitively than comparing two means."""
    accs = []
    for i, m in enumerate(MESSAGES):
        audio, clean = G.generate(m, checkpoint=ckpt, seed=900 + i)
        text = G.decode_natural(audio, checkpoint=ckpt)
        accs.append(codec.edit_distance_accuracy(clean, text))
    return np.array(accs)


def detector_gap(ckpt, sp, n_wild=60):
    """Separation between wild recordings and real messages, for THIS model."""
    wild = []
    for p in sorted(glob.glob(os.path.join(sp.clips_dir, "*.wav")))[:n_wild]:
        a, _ = sf.read(p)
        _, s = G.decode_natural(np.ascontiguousarray(a, dtype=np.float32),
                                checkpoint=ckpt, return_score=True)
        wild.append(s)
    msg = []
    for i, m in enumerate(MESSAGES[:6]):
        audio, _ = G.generate(m, checkpoint=ckpt, seed=700 + i)
        _, s = G.decode_natural(audio, checkpoint=ckpt, return_score=True)
        msg.append(s)
    return max(wild), min(msg), min(msg) - max(wild)


def report(ckpt, sp, val_fraction=VAL_FRACTION):
    name = os.path.basename(ckpt)
    n_params = sum(p.numel() for p in G._load_net(ckpt).parameters())
    vl = val_loss_of(ckpt, sp, val_fraction)
    accs = decode_quality(ckpt)
    wild_max, msg_min, gap = detector_gap(ckpt, sp)
    return {
        "name": name, "params": n_params, "val_loss": vl, "accs": accs,
        "decode_mean": float(accs.mean()), "decode_worst": float(accs.min()),
        "perfect": int((accs == 1.0).sum()),
        "wild_max": wild_max, "msg_min": msg_min, "gap": gap,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("checkpoints", nargs="+")
    ap.add_argument("--val-fraction", type=float, default=VAL_FRACTION,
                    dest="val_fraction")
    SP.add_argument(ap)
    args = ap.parse_args()
    sp = SP.get(args.species)
    print(SP.banner(sp))
    if sp.code not in ("wren", "wren222"):
        print("  !! generate.py's motif bank, frequency map and decoder "
              "constants are still WREN-SPECIFIC.\n"
              "     decode/detector columns below are not meaningful for "
              "another species yet.")

    rows = []
    for c in args.checkpoints:
        if not os.path.exists(c):
            print(f"  (skipping missing {c})")
            continue
        print(f"evaluating {os.path.basename(c)} ...", flush=True)
        rows.append(report(c, sp, args.val_fraction))

    print(f"\n{'checkpoint':28} {'params':>9} {'val_loss':>9} "
          f"{'decode':>8} {'worst':>7} {'perfect':>8} {'det.gap':>9}")
    print("-" * 84)
    for r in rows:
        print(f"{r['name']:28} {r['params']:9,} {r['val_loss']:9.3f} "
              f"{100*r['decode_mean']:7.1f}% {100*r['decode_worst']:6.1f}% "
              f"{r['perfect']:4d}/{len(MESSAGES)} {r['gap']:+9.4f}")

    if len(rows) > 1:
        base, new = rows[0], rows[-1]
        print(f"\n{new['name']} vs {base['name']}:")
        d_val = new["val_loss"] - base["val_loss"]
        print(f"  val_loss   {d_val:+.3f}  ({'better' if d_val < 0 else 'WORSE'})")

        # Paired difference + its own error bar. A mean difference without an
        # error bar cannot tell you whether you learned anything.
        d = new["accs"] - base["accs"]
        se = d.std(ddof=1) / np.sqrt(len(d))
        verdict = "REAL" if abs(d.mean()) > 2 * se else "WITHIN NOISE"
        print(f"  decode     {100*d.mean():+.2f}pp  +/- {100*se:.2f}pp (SE)  -> {verdict}")
        print(f"             better on {(d>0).sum()}, worse on {(d<0).sum()}, "
              f"tied on {(d==0).sum()} of {len(d)} messages")
        print(f"  detector gap {base['gap']:+.4f} -> {new['gap']:+.4f}")
        if new["gap"] <= 0:
            # Never suggest a midpoint when the populations OVERLAP — there is
            # no threshold that works, and printing a plausible-looking number
            # would invite someone to paste it in and ship a broken detector.
            print(f"  -> POPULATIONS OVERLAP by {-new['gap']:.4f}: NO threshold "
                  f"separates birds from messages for this checkpoint.")
        else:
            print(f"\n  NOTE: a new checkpoint needs its own _MESSAGE_THRESHOLD "
                  f"(run calibrate.py; roughly "
                  f"{(new['wild_max']+new['msg_min'])/2:.3f})")


if __name__ == "__main__":
    main()
