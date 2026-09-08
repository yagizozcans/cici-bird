"""
The DATA TRANSFORMER (ML-3, step 1).

Raw audio is not what the model conditions on. DDSP feeds the synth two
human-meaningful control features, extracted from each real clip:

    f0        : the pitch (fundamental frequency) over time  — "which note"
    loudness  : the energy over time                          — "how loud"

The model's job (next file) is to predict TIMBRE (harmonic mix + noise) given
these two. So here we just need to measure f0 and loudness from the recordings.

Proper DDSP uses a pretrained neural pitch tracker (CREPE). We don't have it, so
we estimate f0 the same way your codec's decoder already does — the dominant
frequency per short frame via the FFT. It's rough for fast birdsong, but good
enough to condition on, and the model learns to compensate. Honest shortcut,
named as one.
"""

import argparse
import glob
import os

import numpy as np
import soundfile as sf

import species as SP
from config import SAMPLE_RATE, HOP

WIN = 1024      # DEFAULT analysis window (~46 ms). Per-species; see species.py —
                # the sparrow uses 256 because its pitch sweeps ~947 Hz inside
                # a 1024 window, which averages the song into mush.

# The pitch band is NOT a constant here any more. It is a property of the bird
# and lives in species.py, because the wren's 500-9000 Hz is wrong for a bird
# that sings lower — and a wrong band produces plausible features rather than an
# error. Callers must say which band they mean.


def extract_features(audio: np.ndarray, band, win: int = WIN):
    """audio -> (f0, amplitude, centroid) arrays, one value per HOP-spaced frame.

    `band` is (fmin, fmax) for the species being analysed; get it from
    species.get(key).band rather than assuming the wren's.

    CENTROID is the third conditioning feature, added 2026-09-08. Measured
    cause: grouping real frames by (f0, loudness) alone leaves 59% of the
    spectral-centroid variation unexplained for the sparrow (45% for the wren),
    so a model given only those two inputs cannot know which timbre to produce
    and renders the conditional MEAN — audibly flat, "less coloured". Centroid
    is the brightness axis that was missing, and it is one number per frame.

    Note it is computed over the FULL spectrum, not the pitch band: brightness
    lives in the harmonics above fmax as much as below it.
    """
    fmin, fmax = band
    window = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1 / SAMPLE_RATE)
    in_band = (freqs >= fmin) & (freqs <= fmax)
    bin_hz = SAMPLE_RATE / win

    f0, amp, cen = [], [], []
    for start in range(0, len(audio), HOP):
        seg = audio[start:start + win]
        if len(seg) < win:
            seg = np.pad(seg, (0, win - len(seg)))
        # loudness: root-mean-square energy of the frame (linear).
        amp.append(float(np.sqrt(np.mean(seg ** 2))))
        mag = np.abs(np.fft.rfft(seg * window))
        # brightness: the energy-weighted mean frequency of the whole frame.
        total = mag.sum()
        cen.append(float((mag * freqs).sum() / total) if total > 0 else 0.0)
        # pitch: strongest frequency within the bird's band, refined to
        # SUB-BIN precision by fitting a parabola through the peak and its two
        # neighbours in log-magnitude. A short window buys time resolution at
        # the cost of coarse bins; this hands most of the frequency precision
        # back, so we are not forced to choose.
        banded = mag.copy()
        banded[~in_band] = 0
        k = int(np.argmax(banded))
        f = freqs[k]
        if 0 < k < len(banded) - 1 and banded[k] > 0:
            al = np.log(banded[k - 1] + 1e-12)
            be = np.log(banded[k] + 1e-12)
            ga = np.log(banded[k + 1] + 1e-12)
            denom = al - 2 * be + ga
            if abs(denom) > 1e-12:
                f += np.clip(0.5 * (al - ga) / denom, -0.5, 0.5) * bin_hz
        f0.append(float(f))
    return np.array(f0), np.array(amp), np.array(cen)


def load_clip(path: str) -> np.ndarray:
    x, _ = sf.read(path)
    if x.ndim > 1:
        x = x.mean(axis=1)
    return x.astype(np.float32)


def list_clips(sp) -> list:
    """Every clip for one species, in a fixed order (sorted, so the train/val
    split lands on the same clips on every machine and every run)."""
    paths = sorted(glob.glob(os.path.join(sp.clips_dir, "*.wav")))
    if not paths:
        raise SystemExit(f"no .wav files in {os.path.normpath(sp.clips_dir)}")
    return paths


def resynth_pitch(f0: np.ndarray, amp: np.ndarray, n: int) -> np.ndarray:
    """Re-create a PURE SINE that follows the extracted f0 and loudness.

    This is our audible test: if this whistled trace tracks the wren's melody,
    the feature extractor works. Same cumsum-phase trick you already know.
    """
    frame_pos = np.arange(len(f0)) * HOP
    t = np.arange(n)
    f0_up = np.interp(t, frame_pos, f0)
    amp_up = np.interp(t, frame_pos, amp)
    phase = 2 * np.pi * np.cumsum(f0_up) / SAMPLE_RATE
    return (amp_up * np.sin(phase)).astype(np.float32)


def measure_band(sp, n=200, quantiles=(0.01, 0.99)):
    """Where does this species actually put its energy?

    Run this BEFORE trusting a new bird's fmin/fmax. It sweeps the loudest
    frames of n clips with a deliberately WIDE band, then reports the quantiles
    of the dominant frequency. Quantiles, not min/max: a single frame of hum or
    a single harmonic spike would drag an extreme all the way to the edge, and
    the band you want is where the bird lives, not where it has ever been.
    """
    freqs = np.fft.rfftfreq(WIN, 1 / SAMPLE_RATE)
    window = np.hanning(WIN)
    wide = (freqs >= 200) & (freqs <= 11025)
    picks = []
    for p in list_clips(sp)[:n]:
        a = load_clip(p)
        frames = [a[i:i + WIN] for i in range(0, max(len(a) - WIN, 1), HOP)]
        if not frames:
            continue
        rms = np.array([np.sqrt(np.mean(f ** 2)) for f in frames])
        loud_enough = rms >= np.quantile(rms, 0.75)   # ignore the silent frames
        for f, keep in zip(frames, loud_enough):
            if not keep:
                continue
            mag = np.abs(np.fft.rfft(f * window))
            mag[~wide] = 0
            picks.append(freqs[np.argmax(mag)])
    picks = np.array(picks)
    lo, hi = np.quantile(picks, quantiles)
    return picks, lo, hi


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    SP.add_argument(ap)
    ap.add_argument("--measure-band", action="store_true",
                    help="report where this species' energy actually sits")
    a = ap.parse_args()
    sp = SP.get(a.species)

    clips = list_clips(sp)
    print(SP.banner(sp, len(clips)))
    print(f"dir: {os.path.normpath(sp.clips_dir)}")

    if a.measure_band:
        picks, lo, hi = measure_band(sp)
        print(f"\ndominant frequency over {len(picks)} loud frames:")
        for q in (0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99):
            print(f"  p{100*q:04.1f}  {np.quantile(picks, q):7.0f} Hz")
        print(f"\nsuggested band for {sp.key}: ({int(lo//50*50)}, "
              f"{int(-(-hi//50)*50)})   current: {sp.band}")
        raise SystemExit

    audio = load_clip(clips[0])
    f0, amp, cen = extract_features(audio, sp.band, sp.win)
    print(f"clip: {os.path.basename(clips[0])}  ({len(audio)} samples)")
    print(f"features per clip: {len(f0)} frames")
    print(f"f0  range: {f0.min():.0f}..{f0.max():.0f} Hz  (median {np.median(f0):.0f})")
    print(f"amp range: {amp.min():.3f}..{amp.max():.3f}")
    print(f"centroid  : {cen.min():.0f}..{cen.max():.0f} Hz  (median {np.median(cen):.0f})")

    # audible verification: original vs. the pure-tone pitch trace
    os.makedirs("out", exist_ok=True)
    orig, trace = f"out/{sp.code}_original.wav", f"out/{sp.code}_f0_trace.wav"
    sf.write(orig, audio, SAMPLE_RATE)
    sf.write(trace, resynth_pitch(f0, amp, len(audio)), SAMPLE_RATE)
    print(f"wrote {orig} and {trace}  (compare them)")
