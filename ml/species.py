"""
The SPECIES REGISTRY — one place that knows what makes a bird a bird.

Everything in ml/ used to be wired to the Bewick's wren by hardcoded constants
scattered across files: the corpus path in data.py, the pitch band next to it,
the checkpoint name in train.py, the wild-clip directory in calibrate.py and
decode_report.py. That is fine for one bird and a trap for two, because the
constants are not independent — a checkpoint trained on robin audio with the
wren's pitch band is a valid-looking file that is quietly wrong.

So they live together, keyed by species, and every script takes --species.

WHY THE PITCH BAND IS PART OF THE SPECIES, NOT A GLOBAL

data.py finds f0 by taking the strongest FFT bin inside [FMIN, FMAX]. That band
is not a formality: set it too low and the tracker locks onto background rumble;
set it too high and it picks the second harmonic instead of the fundamental, so
every f0 the model ever sees is double the truth. The model then learns to
render "the timbre of a bird singing an octave up", and nothing downstream can
undo it. The band belongs to the species the way the corpus does.

Only the wren's band has actually been MEASURED. The others carry the wren's
band as a placeholder and are flagged unverified, so training one prints a
warning instead of pretending the number means something.
"""

import os
from dataclasses import dataclass

DATA_ROOT = os.path.join(os.path.dirname(__file__), "..", "data")

# WHY THE ANALYSIS WINDOW IS PER-SPECIES (measured 2026-09-08)
#
# data.py reports ONE f0 per window. Measured on real song sparrow clips, the
# pitch moves a median of 947 Hz (p75 2412, p90 3790) INSIDE a single 1024-sample
# window — 46 ms is long compared to how fast this bird sweeps, so the number we
# hand the oscillator is an average over a ~1 kHz glide. The oscillator then
# cannot line up with the real tone, and the spectral loss buys the difference
# with the NOISE generator. That is the measured mush: real notes have a
# peak-to-valley ratio of 21, ours 9.
#
# Frequency resolution is NOT the binding constraint — the sub-bin quantisation
# error we were discarding is only 5.1 Hz median against a 947 Hz smear. So
# trade frequency resolution for TIME resolution and recover the sub-bin part by
# parabolic interpolation instead.
#
# The wren keeps 1024 deliberately: the shipped model, its motif bank and its
# calibrated threshold were all derived at that window.


@dataclass(frozen=True)
class Species:
    key: str            # what you pass to --species
    code: str           # short prefix for checkpoints / logs / reports
    name: str           # display name
    subdir: str         # clip directory, relative to data/
    fmin: int           # pitch-tracking band, Hz
    fmax: int
    band_verified: bool  # has this band been measured on THIS species?
    win: int = 1024      # FFT analysis window, samples. See below.
    note: str = ""

    @property
    def clips_dir(self) -> str:
        return os.path.join(DATA_ROOT, self.subdir)

    @property
    def band(self) -> tuple:
        return (self.fmin, self.fmax)


SPECIES = {s.key: s for s in [
    # The full corpus, 893 clips. This is the default wren.
    # win=256 since 2026-09-08. Measured: the wren's pitch moves a median
    # 1723 Hz inside a 1024-sample window and only 689 Hz inside a 256 — less
    # extreme than the sparrow's 2412 Hz but the same defect, so the same fix.
    # NOTE the SHIPPED checkpoints/wren.pt predates this and was trained at
    # 1024; reproduce that with `train.py --win 1024`.
    Species("bewicks_wren", "wren", "Bewick's Wren", "bewicks_wren/wavfiles",
            500, 9000, True, win=256),

    # The 222-clip subset the SHIPPED model was trained on, kept as its own
    # species so the original result stays reproducible and the 222-vs-893
    # comparison is a one-flag difference rather than an edit.
    Species("bewicks_wren_222", "wren222", "Bewick's Wren (original 222)",
            "bewicks_wren", 500, 9000, True, win=256,
            note="corpus of checkpoints/wren.pt (baseline60, trained at win=1024)"),

    Species("american_robin", "robin", "American Robin",
            "american_robin/wavfiles", 500, 9000, False),
    # MEASURED 2026-09-08 over 76,500 loud frames (data.py --measure-band, plus
    # a 250 Hz histogram — the quantiles alone would have hidden this):
    # p01 237 | p05 1507 | p25 2046 | p50 2584 | p75 3359 | p95 4737 | p99 7300.
    # The histogram is BIMODAL. 4% of loud frames sit under 1250 Hz (rumble,
    # wind, distant traffic), then a valley at 750-1500 Hz where density falls
    # to 0.4%, then the song itself starts abruptly at 1500 Hz and carries 80%
    # of the mass between 1500 and 4000. fmin 1500 sits IN that valley: above
    # the whole noise pocket, at the foot of the real song. Copying the
    # sparrow's 800 would have put the tracker's floor inside the rumble.
    # fmax 8000 clears p99 with headroom, per the same rule as the sparrow.
    #
    # win=256: the cardinal's pitch travels a median 1034 Hz inside a 1024
    # window and only 172 Hz inside a 256 (p75 861). At 256 the smear is the
    # same order as the 86 Hz bin width, and parabolic interpolation in data.py
    # hands the sub-bin precision back — so 256 costs nothing and stops the
    # slurred whistles being averaged into mush.
    Species("northern_cardinal", "cardinal", "Northern Cardinal",
            "northern_cardinal/wavfiles", 1500, 8000, True, win=256),
    Species("northern_mockingbird", "mockingbird", "Northern Mockingbird",
            "northern_mockingbird/wavfiles", 500, 9000, False),
    # MEASURED 2026-09-08 over 51,000 loud frames (data.py --measure-band):
    # p01 258 | p05 1120 | p25 3467 | p50 4285 | p75 5685 | p95 7063 | p99 7623.
    # fmin 800 sits above the ~258 Hz noise pocket but well below p05, so real
    # low notes are not clipped; fmax 8000 clears p99 with headroom. Do NOT use
    # p05 as fmin — the bottom of every species' measured range is background
    # noise inside voiced frames, not song.
    Species("song_sparrow", "sparrow", "Song Sparrow",
            "song_sparrow/wavfiles", 800, 8000, True, win=256),
]}

DEFAULT = "bewicks_wren"


def get(key: str) -> Species:
    if key not in SPECIES:
        raise SystemExit(
            f"unknown species {key!r}. known: {', '.join(sorted(SPECIES))}")
    sp = SPECIES[key]
    if not os.path.isdir(sp.clips_dir):
        raise SystemExit(f"{key}: no such directory {os.path.normpath(sp.clips_dir)}")
    return sp


def add_argument(ap):
    """Give any script the same --species flag, spelled the same way."""
    ap.add_argument("--species", default=DEFAULT, choices=sorted(SPECIES),
                    help=f"which bird (default: {DEFAULT})")


def banner(sp: Species, n_clips=None) -> str:
    line = f"species: {sp.name}  [{sp.key}]  band {sp.fmin}-{sp.fmax} Hz"
    if n_clips is not None:
        line += f"  clips {n_clips}"
    if not sp.band_verified:
        line += ("\n  !! PITCH BAND NOT MEASURED for this species — it is the "
                 "wren's band as a placeholder.\n"
                 "     Measure the real band before trusting anything trained "
                 "with it (see data.py --species).")
    return line


if __name__ == "__main__":
    import glob
    print(f"{'key':22} {'code':12} {'clips':>6}  {'band':>12}  dir")
    for k, s in SPECIES.items():
        n = len(glob.glob(os.path.join(s.clips_dir, "*.wav")))
        v = "" if s.band_verified else "  (unverified)"
        print(f"{k:22} {s.code:12} {n:6}  {s.fmin:5}-{s.fmax:5}{v}  {s.subdir}")
