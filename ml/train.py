"""
The TRAINING LOOP — the "evolution" (ML-3, step 4).

This wires all five organs into the classic loop that every supervised model on
earth is trained by:

    for each batch:
        pred  = synth(model(features))      # forward:  make a guess
        error = loss(pred, real_audio)      # grade it against the REAL bird
        error.backward()                    # find which knob-nudges reduce error
        optimizer.step()                    # nudge the weights a little

Repeat thousands of times and the guess crawls toward the real sound.

v2 — NOW WITH A VALIDATION SET, which the first version did not have.

The original trained on all 222 wren clips and reported only the TRAINING loss. That
number cannot tell you the one thing you actually want to know: is the model
learning the Bewick's wren's voice, or just memorizing 222 particular
recordings? Both look identical on a training curve — both go down. The moment
you want to answer "did my change make it BETTER?", a training loss is not
evidence, because a bigger model always fits the training set better whether or
not it has learned anything transferable.

So: clips are split once, deterministically, into train and validation. The
model never trains on the validation clips, and every decision — is it underfit,
did the bigger model help, when do we stop — is read off the VALIDATION curve.
The checkpoint saved is the one with the best validation loss, not the last one,
because the last epoch is not usually the best epoch.

    python train.py overfit                          # smoke test: memorize 1 clip
    python train.py full --epochs 60 --tag baseline  # honest run, train+val

v3 — SPECIES-AWARE. The corpus, the pitch band and the feature cache are all
chosen by --species (see species.py); nothing about a bird is hardcoded here.

    python train.py full --species bewicks_wren      --tag full893
    python train.py full --species bewicks_wren_222  --tag repro222
"""

import argparse
import csv
import hashlib
import os
import time

import numpy as np
import soundfile as sf
import torch
from torch.utils.data import DataLoader, TensorDataset

import dataclasses

import species as SP
from config import SAMPLE_RATE, HOP, DEVICE
from data import list_clips, load_clip, extract_features
from model import DDSPDecoder
from synth import synthesize
from loss import multiscale_spectral_loss

N_SAMPLES = 66150                       # 3.00 s at 22050 Hz (every clip)
N_FRAMES = len(range(0, N_SAMPLES, HOP))

VAL_FRACTION = 0.10                     # 90/10 split
SPLIT_SEED = 1234                       # fixed so every run sees the SAME split
SUBSET_SEED = 4321                      # fixed so --max-clips picks the SAME subset


def apply_clip_list(paths, list_path):
    """Restrict the corpus to an explicit, ranked selection of clips.

    Selection is a first-class input, not a detail: on this project changing
    WHICH clips were used moved decode accuracy further than changing how many,
    how big the model was, or how long it trained. Keeping the chosen filenames
    in a file under selections/ means a run can be reproduced exactly and the
    choice can be argued with.
    """
    import json
    with open(list_path) as fh:
        want = set(json.load(fh))
    keep = [p for p in paths if os.path.basename(p) in want]
    missing = want - {os.path.basename(p) for p in keep}
    if missing:
        raise SystemExit(f"{len(missing)} clips in {list_path} are not in the "
                         f"corpus, e.g. {sorted(missing)[:3]}")
    return keep


def group_split(paths, val_fraction, seed=None):
    """Hold out whole RECORDINGS, never individual clips.

    Clips are 3-second chunks of one continuous recording, so a random split by
    clip puts chunk 4 of a recording in training and chunk 5 in validation —
    three seconds later, same bird, same song, same microphone. That is a
    near-duplicate, and validation measured against it answers a much easier
    question than "does this generalise to a bird it has not heard".

    The cost is that the split lands NEAR the requested fraction rather than on
    it: recordings contribute different numbers of clips and cannot be cut in
    half. The actual counts are printed, never assumed.
    """
    rng = np.random.default_rng(SPLIT_SEED if seed is None else seed)
    recs = {}
    for i, p in enumerate(paths):
        recs.setdefault(os.path.basename(p).split("-")[0], []).append(i)
    keys = list(recs)
    rng.shuffle(keys)
    target = val_fraction * len(paths)
    val = []
    for k in keys:
        if len(val) >= target:
            break
        val.extend(recs[k])
    val = np.array(sorted(val))
    train = np.array([i for i in range(len(paths)) if i not in set(val.tolist())])
    return train, val


def subset(paths, n):
    """Take n clips SPREAD ACROSS THE CORPUS, not the first n.

    Clips are named <recording-id>-<chunk>, so sorted order groups them by
    recording. The first 250 song sparrow files come from a handful of
    recordings — a handful of individual birds in a handful of places. A seeded
    random draw over the whole corpus covers far more recordings for the same
    clip count, which is the axis that actually varies the voice.
    """
    if n is None or n >= len(paths):
        return paths
    rng = np.random.default_rng(SUBSET_SEED)
    return [paths[i] for i in sorted(rng.permutation(len(paths))[:n])]


def cache_path(sp):
    return os.path.join(os.path.dirname(__file__), f"feature_cache_{sp.key}.npz")


def _fingerprint(sp, paths):
    """What the cached features actually depend on.

    Anything that would change the numbers goes in here: which clips, which
    pitch band, and the frame geometry. If any of it differs from what was
    cached, the cache is for a different question and must not be reused.
    """
    h = hashlib.sha1()
    h.update("\n".join(os.path.basename(p) for p in paths).encode())
    # FEATVER bumps whenever the feature SET changes (v2 added spectral
    # centroid). Without it, a cache written before the change would be a
    # legitimate hit for a fingerprint that now means something else.
    return (f"v3|{sp.key}|{len(paths)}|{sp.fmin}-{sp.fmax}|win{sp.win}|"
            f"{N_SAMPLES}|{HOP}|{h.hexdigest()[:12]}")


def load_cache(sp, paths=None):
    """Extract (f0, loudness, centroid, audio) for every clip once; cache to disk.

    THE BUG THIS REPLACES: the old version took `paths`, then ignored it
    entirely whenever a cache file existed. One unkeyed feature_cache.npz served
    every caller, so pointing DATA_DIR at a new bird and training would load the
    WREN's features, run a clean-looking 60 epochs, and save a checkpoint named
    after a species it had never heard. No error, no warning — the failure is
    invisible because a cache hit looks exactly like a cache hit.

    Same shape as the _NETS bug in generate.py: a cache whose key omitted
    something the value depends on. So the key now carries all of it, and a
    mismatch recomputes rather than silently answering the wrong question.
    """
    paths = paths if paths is not None else list_clips(sp)
    path, want = cache_path(sp), _fingerprint(sp, paths)

    if os.path.exists(path):
        d = np.load(path, allow_pickle=False)
        got = str(d["fingerprint"]) if "fingerprint" in d.files else "(unkeyed)"
        if got == want:
            print(f"  features: cache hit ({os.path.basename(path)})")
            return (torch.tensor(d["f0"]), torch.tensor(d["loud"]),
                    torch.tensor(d["cen"]), torch.tensor(d["aud"]))
        print(f"  features: cache STALE, recomputing\n"
              f"            cached {got}\n            wanted {want}")

    f0s, louds, cens, auds = [], [], [], []
    for i, p in enumerate(paths):
        a = load_clip(p)
        a = np.pad(a, (0, N_SAMPLES - len(a)))[:N_SAMPLES]
        f0, amp, cen = extract_features(a, sp.band, sp.win)
        f0s.append(f0[:N_FRAMES]); louds.append(amp[:N_FRAMES])
        cens.append(cen[:N_FRAMES]); auds.append(a)
        if (i + 1) % 50 == 0:
            print(f"  extracted features {i+1}/{len(paths)}", flush=True)
    f0 = np.array(f0s, np.float32); loud = np.array(louds, np.float32)
    cen = np.array(cens, np.float32); aud = np.array(auds, np.float32)
    np.savez(path, f0=f0, loud=loud, cen=cen, aud=aud, fingerprint=np.array(want))
    return (torch.tensor(f0), torch.tensor(loud), torch.tensor(cen),
            torch.tensor(aud))


def split_indices(n, val_fraction=VAL_FRACTION):
    """One fixed train/val split, identical across every run.

    Fixed on purpose: if the split were reshuffled per run, a "better" result
    could just be an easier validation set, and two runs would not be
    comparable. Holding it constant makes the only difference between runs the
    thing you actually changed.
    """
    rng = np.random.default_rng(SPLIT_SEED)
    order = rng.permutation(n)
    n_val = max(1, int(round(val_fraction * n)))
    return order[n_val:], order[:n_val]        # train, val


def render(net, f0, loud, cen=None):
    net.eval()
    with torch.no_grad():
        amp, harm, noise = net(f0, loud, cen)
        return synthesize(f0, amp, harm, noise, N_SAMPLES)


def evaluate(net, loader, device):
    """Average loss over a loader, with no gradients and no weight updates."""
    net.eval()
    total, batches = 0.0, 0
    with torch.no_grad():
        for bf0, bloud, bcen, baud in loader:
            bf0, bloud = bf0.to(device), bloud.to(device)
            bcen, baud = bcen.to(device), baud.to(device)
            amp, harm, noise = net(bf0, bloud, bcen)
            pred = synthesize(bf0, amp, harm, noise, N_SAMPLES)
            total += multiscale_spectral_loss(pred, baud).item()
            batches += 1
    return total / max(batches, 1)


def overfit(device, sp=None, **_):
    """Smoke test: can the loop force the model to memorize ONE clip?

    Deliberately has no validation set — memorizing is the whole point. If this
    CANNOT reach a low loss, the model can't even represent the target, which is
    a capacity problem, not a training problem. (That diagnostic is how we found
    the synth was missing its noise component: harmonics alone plateaued at 12.6
    on a single clip, and adding filtered noise dropped it to 8.4.)
    """
    paths = list_clips(sp)
    a = np.pad(load_clip(paths[0]), (0, N_SAMPLES))[:N_SAMPLES]
    f0_np, loud_np, cen_np = extract_features(a, sp.band, sp.win)
    f0 = torch.tensor(f0_np[:N_FRAMES], dtype=torch.float32)[None].to(device)
    loud = torch.tensor(loud_np[:N_FRAMES], dtype=torch.float32)[None].to(device)
    cen = torch.tensor(cen_np[:N_FRAMES], dtype=torch.float32)[None].to(device)
    target = torch.tensor(a, dtype=torch.float32)[None].to(device)

    net = DDSPDecoder(n_in=3).to(device)
    opt = torch.optim.Adam(net.parameters(), lr=3e-3)

    os.makedirs("out", exist_ok=True)
    sf.write(f"out/overfit_{sp.code}_target.wav", a, SAMPLE_RATE)
    sf.write(f"out/overfit_{sp.code}_step000.wav",
             render(net, f0, loud, cen)[0].cpu().numpy(), SAMPLE_RATE)

    t0 = time.time()
    for step in range(1, 401):
        net.train()
        amp, harm, noise = net(f0, loud, cen)
        pred = synthesize(f0, amp, harm, noise, N_SAMPLES)
        l = multiscale_spectral_loss(pred, target)
        opt.zero_grad(); l.backward(); opt.step()
        if step % 50 == 0:
            print(f"  step {step:4d}   loss {l.item():7.3f}   ({time.time()-t0:.0f}s)")

    sf.write(f"out/overfit_{sp.code}_final.wav",
             render(net, f0, loud, cen)[0].cpu().numpy(), SAMPLE_RATE)
    print(f"wrote out/overfit_{sp.code}_" + "{target,step000,final}.wav")


def train_full(device, sp=None, epochs=60, hidden=128, lr=1e-3, batch=4,
               tag="run", val_fraction=VAL_FRACTION, max_clips=None,
               centroid=False, clip_list=None, split="clip", **_):
    """Learn one species' voice in general, judged on clips it never trains on."""
    clips = list_clips(sp)
    if clip_list:
        clips = apply_clip_list(clips, clip_list)
    clips = subset(clips, max_clips)
    n_rec = len({os.path.basename(p).split("-")[0] for p in clips})
    print(SP.banner(sp, len(clips)))
    print(f"corpus: {len(clips)} clips from {n_rec} distinct recordings")
    print("loading features for all clips...")
    f0, loud, cen, aud = load_cache(sp, clips)
    if split == "recording":
        tr, va = group_split(clips, val_fraction)
        vr = len({os.path.basename(clips[i]).split("-")[0] for i in va})
        tr_r = len({os.path.basename(clips[i]).split("-")[0] for i in tr})
        print(f"split: {len(tr)} train / {len(va)} validation clips, BY RECORDING "
              f"({tr_r} train / {vr} val recordings, no overlap, seed {SPLIT_SEED})")
    else:
        tr, va = split_indices(len(f0), val_fraction)
        print(f"split: {len(tr)} train / {len(va)} validation clips "
              f"({100*(1-val_fraction):.0f}/{100*val_fraction:.0f}, seed {SPLIT_SEED})")

    train_loader = DataLoader(TensorDataset(f0[tr], loud[tr], cen[tr], aud[tr]),
                              batch_size=batch, shuffle=True)
    val_loader = DataLoader(TensorDataset(f0[va], loud[va], cen[va], aud[va]),
                            batch_size=batch)

    net = DDSPDecoder(hidden=hidden, n_in=3 if centroid else 2).to(device)
    n_params = sum(p.numel() for p in net.parameters())
    opt = torch.optim.Adam(net.parameters(), lr=lr)

    ckpt = f"checkpoints/{sp.code}_{tag}.pt"
    log_path = f"out/train_{sp.code}_{tag}.csv"
    os.makedirs("checkpoints", exist_ok=True); os.makedirs("out", exist_ok=True)
    print(f"tag={tag}  hidden={hidden}  params={n_params:,}  lr={lr}  "
          f"epochs={epochs}  inputs={'f0+loud+centroid' if centroid else 'f0+loud'}")

    best_val, best_epoch = float("inf"), 0
    with open(log_path, "w", newline="") as fh:
        log = csv.writer(fh)
        log.writerow(["epoch", "train_loss", "val_loss", "seconds"])

        for epoch in range(1, epochs + 1):
            net.train(); total = 0.0; t0 = time.time()
            for bf0, bloud, bcen, baud in train_loader:
                bf0, bloud = bf0.to(device), bloud.to(device)
                bcen, baud = bcen.to(device), baud.to(device)
                amp, harm, noise = net(bf0, bloud, bcen)
                pred = synthesize(bf0, amp, harm, noise, N_SAMPLES)
                l = multiscale_spectral_loss(pred, baud)
                opt.zero_grad(); l.backward(); opt.step()
                total += l.item()
            train_loss = total / len(train_loader)
            val_loss = evaluate(net, val_loader, device)
            dt = time.time() - t0

            # Save the BEST epoch by validation loss, not the last one. The last
            # epoch is only the best if the model never starts overfitting, and
            # whether it does is precisely what we cannot assume.
            star = ""
            if val_loss < best_val:
                best_val, best_epoch = val_loss, epoch
                torch.save(net.state_dict(), ckpt)
                star = "  <- best"
            print(f"epoch {epoch:3d}/{epochs}  train {train_loss:7.3f}   "
                  f"val {val_loss:7.3f}  ({dt:.0f}s){star}", flush=True)
            log.writerow([epoch, round(train_loss, 4), round(val_loss, 4), round(dt, 1)])
            fh.flush()

            if epoch % 10 == 0 or epoch == epochs:
                sf.write(f"out/recon_{sp.code}_{tag}_ep{epoch:03d}.wav",
                         render(net, f0[va[:1]].to(device),
                                loud[va[:1]].to(device),
                                cen[va[:1]].to(device))[0].cpu().numpy(), SAMPLE_RATE)

    print(f"\ndone. best val {best_val:.3f} at epoch {best_epoch}/{epochs} -> {ckpt}")
    print(f"curves: {log_path}")
    return best_val, best_epoch


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", nargs="?", default="overfit", choices=["overfit", "full"])
    ap.add_argument("device", nargs="?", default=DEVICE)
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--hidden", type=int, default=128)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--batch", type=int, default=4)
    ap.add_argument("--tag", default="run")
    ap.add_argument("--val-fraction", type=float, default=VAL_FRACTION,
                    dest="val_fraction", help="held-out share (default 0.10)")
    ap.add_argument("--max-clips", type=int, default=None, dest="max_clips",
                    help="use only N clips, sampled across the whole corpus")
    ap.add_argument("--centroid", action="store_true",
                    help="condition on spectral centroid as a third input")
    ap.add_argument("--clip-list", default=None, dest="clip_list",
                    help="JSON file of clip basenames to use (see selections/)")
    ap.add_argument("--split", default="clip", choices=["clip", "recording"],
                    help="'recording' holds out whole recordings — no chunk of "
                         "a training recording can appear in validation")
    ap.add_argument("--win", type=int, default=None,
                    help="override the species' FFT analysis window, so an "
                         "earlier run's recipe stays reproducible after the "
                         "registry moves on")
    SP.add_argument(ap)
    a = ap.parse_args()
    sp = SP.get(a.species)
    if a.win:
        # replace() flows the override through the fingerprint and the feature
        # extractor together — the window cannot get out of step with the cache.
        sp = dataclasses.replace(sp, win=a.win)
    print(f"mode={a.mode}  device={a.device}")
    (overfit if a.mode == "overfit" else train_full)(
        a.device, sp=sp, epochs=a.epochs, hidden=a.hidden, lr=a.lr,
        batch=a.batch, tag=a.tag, val_fraction=a.val_fraction,
        max_clips=a.max_clips, centroid=a.centroid,
        clip_list=a.clip_list, split=a.split)
