"""
GENERATION for any species with a trained voice — the wren-only generate.py,
generalised.

generate.py hardcodes the Bewick's wren everywhere: its motif bank is built from
the wren's feature cache, its frequency map was fitted to where the wren model
renders cleanly, and its articulation gaps were measured off wren recordings.
None of that transfers by editing a path. This module keeps the same DESIGN —
which earned its keep on the wren — and takes the per-species numbers from
species.py plus measurement.

WHAT IS KEPT FROM THE WREN DESIGN, AND WHY

  * Notes are REAL BORROWED (pitch, loudness) pairs, taken together from the
    same real note. Hand-written contours always read as synthetic; a real
    note's pitch swing and its envelope belong to each other.
  * Each symbol gets ONE FIXED motif, claimed exclusively. Letters that share a
    shape are indistinguishable by construction.
  * Motifs are frequency-MATCHED: a shape is transplanted only near the pitch it
    was actually sung at, so the model is never driven out of distribution.
  * Articulation gaps BETWEEN notes, real silence only BETWEEN words, and one
    continuous ambient bed so short gaps read as articulation, not dropout.

DECODING is here too, ported the same way. The METHOD carries over unchanged —
motif templates rendered by the model, then Viterbi over the whole signal — but
every NUMBER in it belongs to a species plus a checkpoint and must be re-derived:
the signature bands follow the bird's own frequency range, the gap budgets come
from its measured articulation, and the three search constants and the
message-detection threshold are swept and calibrated per species. Inheriting the
wren's numbers would produce a decoder that looks calibrated and is not.
"""

import os
import sys

import numpy as np
import torch
from scipy.signal import butter, sosfiltfilt

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "engine"))

import birdsong_codec as codec
import species as SP
from config import SAMPLE_RATE, HOP
from model import DDSPDecoder
from synth import harmonic_synth, filtered_noise
from data import list_clips
from train import subset, load_cache

# ---- per-species generation settings ---------------------------------------
# Measured 2026-09-08 (scratchpad/survey.py). Gap ranges straddle each bird's
# own median inter-note gap; the floor stays above the model's own time
# resolution (256-sample noise frames = 11.6 ms) or gaps arrive half-filled.
SETTINGS = {
    #                 note gap (s)   word pause (s)  base Hz  step Hz
    "song_sparrow": dict(gap=(0.030, 0.075), pause=(0.12, 0.22),
                         base=2800.0, step=120.0,
                         # SWEPT for the sparrow on 15 messages and checked on
                         # 15 the sweep never saw (scratchpad/sweep_sparrow.py):
                         # tuning 98.5%, held-out 97.7%, a +0.8pp gap. The grid
                         # is a broad flat plateau — 27 of 27 settings landed
                         # within 1.7pp — and these values sit inside it, so
                         # they are validated for this bird, not inherited.
                         margin=0.48, penalty=2.0, veto=0.20,
                         # The veto never binds for sparrow messages (identical
                         # results from 0.0 to 0.5; it only starts cutting above
                         # 0.9). Kept because it is what stops a letter being
                         # invented inside a word pause, which is a real wren
                         # failure this bird's deeper pauses simply avoid.
                         #
                         # THRESHOLD calibrated over ALL 1256 wild recordings:
                         # wild max +0.1442, messages min +0.1611, so 0.153 with
                         # a +/-0.0084 margin, 0/1256 false positives, 0/30
                         # missed. Belongs to this checkpoint as much as to this
                         # species — templates are rendered BY the model, so
                         # RECALIBRATE after any checkpoint change.
                         #
                         # The tail is why this ran on the whole corpus: the
                         # running maximum sat at +0.0971 for the first 400
                         # clips and only jumped to +0.1442 around clip 500. A
                         # 100-clip calibration would have set 0.129 — below the
                         # true wild maximum — and that clip would have been
                         # reported as a message.
                         threshold=0.153),

    # Measured 2026-09-08 against checkpoints/cardinal_best250.pt
    # (scratchpad survey_cardinal.py / freqmap_cardinal.py).
    #
    # THE FREQUENCY MAP IS NOT THE SPARROW'S, AND COPYING IT WOULD HAVE BEEN
    # THE WREN'S ORIGINAL BUG AGAIN. Under (2800, 120) the cardinal's 31
    # symbols span 2800-6400 Hz, but this bird's usable notes run 1775-4732 Hz
    # (p01-p99, median 2715) and thin out sharply above 4000. Assigning notes
    # under that map drags them a MEDIAN of 213 Hz from the pitch they were
    # actually sung at, worst case 2012 Hz — the shapes get transplanted far
    # outside their own range, which is precisely what the motif design exists
    # to prevent. At (1900, 65) the median transplant error is 10 Hz and the
    # WORST is 62 Hz, i.e. still inside one symbol step, so no letter is sung
    # closer to its neighbour's pitch than to its own. 65 Hz is the widest
    # spacing for which that holds; wider spacing pushes the top letters into
    # the sparse 4000+ region.
    #
    # Unlike the wren, model cleanliness does NOT constrain the map here: the
    # noise/harmonic ratio is a flat 0.06-0.11 across 1200-6000 Hz (the wren
    # was ~0.4 at best and 17-23x below 2400). The cardinal's whistles are
    # strongly tonal and the model learned them that way, so the only binding
    # constraint is where real notes exist to borrow.
    #
    # Gaps measured over 3543 in-phrase gaps in the 250 selected clips:
    # p10 3 | p25 9 | p50 23 | p75 65 | p90 119 ms. The range straddles the
    # 23 ms median, with the floor kept above the model's own 11.6 ms noise
    # frame. The word pause floor sits at 2x the gap ceiling so a boundary
    # cannot be read as articulation.
    #
    # DECODE CONSTANTS calibrated 2026-09-08 for THIS checkpoint
    # (cardinal_best250.pt) with calibrate_species.py.
    #
    # The 3x3x3 grid the sparrow was swept on returned 100% at all 27 points —
    # it located no optimum, only the fact that it sat entirely inside the
    # plateau. Taking its top row would have shipped a TIE-BREAK: sorting by
    # (accuracy, margin, penalty, veto) hands back the largest-valued corner,
    # which here sat one grid step from the margin cliff and exactly on the
    # veto edge. So each axis was walked alone until it fell over:
    #
    #   margin   0.2-0.6 clean | 0.8 -> 88.7% | 1.0 -> 4.3%   (0.0 -> 97.6%)
    #   penalty  0-5 clean     | 10 -> 98.1%  | 20 -> 28.7%
    #   veto     0.0-0.4 clean | 0.6 -> 98.2% | 0.8 -> 69.8%
    #
    # The shipped values are the CENTRE of each plateau, i.e. the furthest
    # point from a measured cliff, not the best score — every value in the
    # plateau scores 100% and picking among them on accuracy is picking noise.
    #
    # Note penalty's plateau reaches 0, but do not read that as "penalty is
    # unnecessary": message accuracy cannot see what penalty is for. It stops
    # the search inventing letters in WILD audio, which shows up in the
    # detector's false-positive rate, not in decoding a message we generated.
    #
    # THRESHOLD over ALL 1074 wild recordings: wild max +0.2266, messages min
    # +0.2513, so 0.239 with a +/-0.0124 margin, 0/1074 false positives and
    # 0/30 missed. The tail justifies the full corpus again: the running max
    # sat at +0.2012 from clip 200 to clip 700 and only moved to +0.2266 at
    # clip 800. Calibrating on the first 700 would have set the threshold below
    # a real wild clip and called that bird a message.
    #
    # Belongs to this checkpoint as much as to this species — templates are
    # rendered BY the model, so RECALIBRATE after any checkpoint change.
    "northern_cardinal": dict(gap=(0.022, 0.060), pause=(0.12, 0.22),
                              base=1900.0, step=65.0,
                              margin=0.40, penalty=2.5, veto=0.20,
                              threshold=0.239),
}

_GAP_FLOOR = 0.0015          # never 0: zero trips the silence gate
_EDGE_THR = 0.002
_MAX_EDGE = 0.25             # reject notes that start/end loud (clipped notes)
_NOTE_RANGE = (0.05, 0.30)   # s, a plausible single note
_MATCH_POOL = 25
_MOTIF_SEED = 20260908
_AMBIENT_DB = -22.0
_GATE_FADE_S = 0.025
_HPF = butter(4, 300, btype="highpass", fs=SAMPLE_RATE, output="sos")

_LIB, _ASSIGN, _NETS = {}, {}, {}


def settings(sp):
    if sp.key not in SETTINGS:
        raise SystemExit(f"no generation settings for {sp.key}; measure its gap "
                         f"statistics and frequency range first")
    return SETTINGS[sp.key]


_DECODE_KEYS = ("margin", "penalty", "veto", "threshold")


def decode_settings(sp, need=_DECODE_KEYS):
    """settings(), but for the decode path, which needs four MORE numbers.

    `need` is what THIS caller cannot supply itself. Calibration is the reason
    it is a parameter: sweeping margin/penalty/veto means passing all three
    explicitly, and a guard that demanded them from the registry first would
    block the only procedure that can ever put them there.

    A species can be fully generatable and not yet decodable: gap/pause/base/
    step are measurements, while margin/penalty/veto are swept on held-out
    messages and the threshold is calibrated against the entire wild corpus for
    ONE checkpoint. Without this guard the difference shows up as a KeyError
    from inside a Viterbi search, which reads like a bug in the search rather
    than the truth — that nobody has calibrated this bird yet.
    """
    s = settings(sp)
    missing = [k for k in need if k not in s]
    if missing:
        raise SystemExit(
            f"{sp.key}: cannot decode — {', '.join(missing)} have never been "
            f"derived for this species. They are per-species AND per-checkpoint "
            f"(templates are rendered by the model), so the sparrow's values "
            f"would give you a decoder that looks calibrated and is not. Sweep "
            f"margin/penalty/veto on held-out messages and calibrate the "
            f"threshold over the whole wild corpus first.")
    return s


def shape_library(sp, max_clips=250):
    """Every usable real note in this species' corpus, as (f0_shape, loudness
    shape, mean_f0). Pitch is de-meaned so the SHAPE can be transplanted; the
    mean is kept so it can be transplanted somewhere it plausibly belongs."""
    if sp.key in _LIB:
        return _LIB[sp.key]
    clips = subset(list_clips(sp), max_clips)
    f0, loud, _cen, _aud = load_cache(sp, clips)
    f0, loud = f0.numpy(), loud.numpy()
    frame_rate = SAMPLE_RATE / HOP
    pairs = []
    for f0c, loudc in zip(f0, loud):
        if loudc.max() <= 0:
            continue
        # Relative voicing threshold: absolute levels differ between recordings,
        # and a fixed cut would harvest notes from the loud ones only.
        thr = 0.15 * np.quantile(loudc, 0.95)
        voiced = loudc > thr
        i = 0
        while i < len(voiced):
            if not voiced[i]:
                i += 1
                continue
            j = i
            while j < len(voiced) and voiced[j]:
                j += 1
            dur = (j - i) / frame_rate
            if _NOTE_RANGE[0] <= dur <= _NOTE_RANGE[1]:
                # Extend outward to recover the note's natural fade in/out —
                # the loudness test finds only its loud core, and cutting there
                # makes every borrowed note start mid-swing.
                max_ext = int(0.03 * frame_rate)
                lo, s = i, 0
                while (lo > 0 and s < max_ext and loudc[lo - 1] < loudc[lo]
                       and loudc[lo - 1] > _EDGE_THR):
                    lo -= 1; s += 1
                hi, s = j, 0
                while (hi < len(loudc) and s < max_ext and loudc[hi] < loudc[hi - 1]
                       and loudc[hi] > _EDGE_THR):
                    hi += 1; s += 1
                seg = f0c[lo:hi].astype(np.float32)
                mean_f0 = float(seg.mean())
                ls = loudc[lo:hi].astype(np.float32)
                if np.abs(seg - mean_f0).max() > 1e-3 and ls.max() > 1e-4:
                    ls = ls / ls.max()
                    if ls[0] <= _MAX_EDGE and ls[-1] <= _MAX_EDGE:
                        pairs.append((seg - mean_f0, ls, mean_f0))
            i = j
    _LIB[sp.key] = pairs
    return pairs


def symbol_freq(sp, ch):
    s = settings(sp)
    return s["base"] + codec.ALPHABET.index(ch) * s["step"]


def motif_assignment(sp):
    """symbol -> library index, GUARANTEED UNIQUE. Two letters sharing a shape
    differ only by a frequency offset, which no template matcher can separate."""
    if sp.key in _ASSIGN:
        return _ASSIGN[sp.key]
    pairs = shape_library(sp)
    means = np.array([m for _, _, m in pairs])
    taken, assign = set(), {}
    for ch in codec.ALPHABET:
        base = symbol_freq(sp, ch)
        rng = np.random.default_rng(_MOTIF_SEED + codec.ALPHABET.index(ch))
        order = [i for i in np.argsort(np.abs(means - base)) if i not in taken]
        if not order:
            raise SystemExit("shape library exhausted — not enough usable notes")
        pick = int(order[rng.integers(0, min(_MATCH_POOL, len(order)))])
        taken.add(pick)
        assign[ch] = pick
    _ASSIGN[sp.key] = assign
    return assign


def note_for(sp, ch):
    f0_shape, loud_shape, _ = shape_library(sp)[motif_assignment(sp)[ch]]
    f0 = np.maximum(symbol_freq(sp, ch) + f0_shape, 250.0)
    return f0.astype(np.float32), loud_shape.astype(np.float32)


def message_to_contour(sp, text, seed=0, with_spans=False):
    """text -> (f0, loudness, clean), and optionally where each letter is sung.

    `with_spans` returns a fourth value: [(char, start_frame, end_frame)] for
    every SUNG character, spaces excluded — a space is a pause, not a note.
    Only this function knows when a letter actually sounds, because a message
    here has no grid: every note is a real borrowed note at its own natural
    length, separated by randomly-drawn articulation gaps. Anything downstream
    that needs the timing (subtitles on the website) has to be told, not left
    to reconstruct it from arithmetic that does not apply.
    """
    s = settings(sp)
    clean = codec.normalize(text)
    frame_dt = HOP / SAMPLE_RATE
    f0_parts, loud_parts, spans = [], [], []
    cursor = 0
    words = clean.split(" ")
    for wi, word in enumerate(words):
        prev_f0 = prev_loud = None
        for i, ch in enumerate(word):
            rng = np.random.default_rng(seed + wi * 5000 + i * 97)
            f0, ls = note_for(sp, ch)
            loud = (rng.uniform(0.22, 0.34) * ls).astype(np.float32)
            if prev_f0 is not None:
                k = max(2, int(rng.uniform(*s["gap"]) / frame_dt))
                half = k // 2
                f0_parts.append(np.linspace(prev_f0, f0[0], k, dtype=np.float32))
                loud_parts.append(np.concatenate([
                    np.linspace(prev_loud, _GAP_FLOOR, half, dtype=np.float32),
                    np.linspace(_GAP_FLOOR, loud[0], k - half, dtype=np.float32)]))
                cursor += k
            f0_parts.append(f0); loud_parts.append(loud)
            spans.append((ch, cursor, cursor + len(f0)))
            cursor += len(f0)
            prev_f0, prev_loud = f0[-1], loud[-1]
        if wi < len(words) - 1:
            rng = np.random.default_rng(seed + wi * 5000 + 1)
            k = max(1, int(rng.uniform(*s["pause"]) / frame_dt))
            f0_parts.append(np.zeros(k, np.float32))
            loud_parts.append(np.zeros(k, np.float32))
            cursor += k
    f0_out = np.concatenate(f0_parts)
    loud_out = np.concatenate(loud_parts)
    if with_spans:
        return f0_out, loud_out, clean, spans
    return f0_out, loud_out, clean


def load_net(ckpt):
    if ckpt not in _NETS:
        st = torch.load(ckpt, map_location="cpu")
        net = DDSPDecoder(hidden=st["amp_head.weight"].shape[1],
                          n_in=st["encode.0.weight"].shape[1])
        net.load_state_dict(st); net.eval()
        _NETS[ckpt] = net
    return _NETS[ckpt]


def generate(text, species_key, checkpoint, seed=0, with_spans=False):
    sp = SP.get(species_key)
    f0_np, loud_np, clean, spans = message_to_contour(
        sp, text, seed, with_spans=True)
    net = load_net(checkpoint)
    if net.n_in != 2:
        raise SystemExit("this generator drives (f0, loudness) only")
    n = len(f0_np) * HOP
    f0 = torch.tensor(f0_np)[None]; loud = torch.tensor(loud_np)[None]
    with torch.no_grad():
        amp, harm, noise = net(f0, loud)
        audio = (harmonic_synth(f0, amp, harm, n)[0].numpy()
                 + filtered_noise(noise, n)[0].numpy())
    audio = sosfiltfilt(_HPF, audio).astype(np.float32)

    # Gate the model's residual during intended pauses, then lay one continuous
    # ambient bed so the background never switches on or off.
    silent = (loud_np <= 1e-6).astype(np.float32)
    mask = np.repeat(1.0 - silent, HOP)[:len(audio)]
    k = int(_GATE_FADE_S * SAMPLE_RATE) | 1
    mask = np.convolve(mask, np.hanning(k) / np.hanning(k).sum(), mode="same")
    audio = audio * mask
    is_sil = np.repeat(silent > 0, HOP)[:len(audio)].astype(bool)
    if (~is_sil).any():
        rms = float(np.sqrt(np.mean(audio[~is_sil] ** 2)))
        bed = np.random.default_rng(seed).normal(0, 1, len(audio)).astype(np.float32)
        bed = sosfiltfilt(_HPF, bed).astype(np.float32)
        bed *= (rms * 10 ** (_AMBIENT_DB / 20)) / (np.sqrt(np.mean(bed ** 2)) + 1e-12)
        audio = audio + bed
    if with_spans:
        # Frames -> seconds. HOP samples per frame, at SAMPLE_RATE.
        return audio, clean, [(ch, a * HOP / SAMPLE_RATE, b * HOP / SAMPLE_RATE)
                              for ch, a, b in spans]
    return audio, clean


if __name__ == "__main__":
    import argparse
    import soundfile as sf
    ap = argparse.ArgumentParser()
    ap.add_argument("text")
    ap.add_argument("-o", "--out", default="out/message.wav")
    ap.add_argument("--checkpoint", default="checkpoints/sparrow_win256.pt")
    ap.add_argument("--seed", type=int, default=0)
    SP.add_argument(ap)
    a = ap.parse_args()
    sp = SP.get(a.species)
    lib = shape_library(sp)
    means = np.array([m for _, _, m in lib])
    print(SP.banner(sp))
    print(f"shape library: {len(lib)} usable notes, "
          f"{means.min():.0f}-{means.max():.0f} Hz")
    audio, clean = generate(a.text, a.species, a.checkpoint, a.seed)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    sf.write(a.out, audio, SAMPLE_RATE)
    print(f'"{clean}"  ->  {a.out}  ({len(audio)/SAMPLE_RATE:.2f}s)')


# ---------------------------------------------------------------------------
# DECODE — motif matching + Viterbi alignment, per species
# ---------------------------------------------------------------------------
# The decode STFT window is NOT data.py's analysis window. It is fixed at 256 so
# that columns land exactly HOP samples apart, i.e. at the same rate as the
# synthesis contour — that alignment is what lets the search use each motif's
# exact known duration. _COL_LAG is the price: a note spanning contour frames
# [a,b) yields only columns a..b-4, because a column needs a full 256-sample
# window inside the note.
_STFT_WIN = 256
_COL_LAG = _STFT_WIN // HOP - 1
SIG_BANDS = 48
SIG_FRAMES = 16

_BANKS = {}          # (species, checkpoint) -> (bank, sig_mean). BOTH keys, or
                     # a second species silently scores against the first's
                     # templates — the cache bug this project has hit twice.


def _sig_edges(sp):
    return np.geomspace(sp.fmin, sp.fmax, SIG_BANDS + 1)


def render_contour(f0_np, loud_np, net):
    """The one path from contour to audio. Templates MUST be rendered by it too,
    or the decoder matches against notes the encoder never actually produces."""
    n = len(f0_np) * HOP
    f0 = torch.tensor(f0_np)[None]
    loud = torch.tensor(loud_np)[None]
    with torch.no_grad():
        amp, harm, noise = net(f0, loud)
        audio = (harmonic_synth(f0, amp, harm, n)[0].numpy()
                 + filtered_noise(noise, n)[0].numpy())
    return sosfiltfilt(_HPF, audio).astype(np.float32)


def _banded(audio, sp):
    edges = _sig_edges(sp)
    win = np.hanning(_STFT_WIN)
    ncols = 1 + max(0, (len(audio) - _STFT_WIN) // HOP)
    idx = np.arange(_STFT_WIN)[None, :] + HOP * np.arange(ncols)[:, None]
    mag = np.abs(np.fft.rfft(audio[idx] * win[None, :], axis=1)).T
    freqs = np.fft.rfftfreq(_STFT_WIN, 1 / SAMPLE_RATE)
    out = np.zeros((SIG_BANDS, ncols))
    for b in range(SIG_BANDS):
        sel = (freqs >= edges[b]) & (freqs < edges[b + 1])
        if sel.any():
            out[b] = mag[sel].sum(axis=0)
    return out


def _sig_from_cols(banded, start, ncols, sig_mean):
    n = banded.shape[1] - start if ncols is None else ncols
    off = np.round(np.linspace(0, max(n - 1, 0), SIG_FRAMES)).astype(int)
    block = banded[:, start + off]
    vec = np.log1p(100.0 * block / (block.max() + 1e-9)).ravel()
    vec = vec / (np.linalg.norm(vec) + 1e-9)
    if sig_mean is not None:
        vec = vec - sig_mean
        vec = vec / (np.linalg.norm(vec) + 1e-9)
    return vec.astype(np.float64)


def template_bank(sp, checkpoint):
    """One signature per symbol, rendered BY this model.

    Signatures are mean-centred (`_discriminative` in generate.py): raw ones are
    spectrograms of notes from a single bird and sit at cosine ~0.93 to each
    other, so almost all of the match score would be "this is a sparrow note"
    rather than "this is the letter k".
    """
    key = (sp.key, checkpoint)
    if key in _BANKS:
        return _BANKS[key]
    net = load_net(checkpoint)
    pad = 20
    raw = []
    for ch in codec.ALPHABET:
        f0, ls = note_for(sp, ch)
        z = np.zeros(pad, dtype=np.float32)
        audio = render_contour(np.concatenate([z, f0, z]),
                               np.concatenate([z, 0.28 * ls, z]), net)
        seg = audio[pad * HOP:(pad + len(f0)) * HOP]
        if len(seg) < _STFT_WIN:
            seg = np.pad(seg, (0, _STFT_WIN - len(seg)))
        raw.append(_sig_from_cols(_banded(seg, sp), 0, None, None))
    raw = np.stack(raw)
    sig_mean = raw.mean(axis=0)
    bank = np.stack([
        (r - sig_mean) / (np.linalg.norm(r - sig_mean) + 1e-9) for r in raw
    ]).astype(np.float64)
    _BANKS[key] = (bank, sig_mean)
    return bank, sig_mean


def symbol_durations(sp):
    """Each motif's exact width in columns — the constraint the search runs on."""
    return np.array([max(4, len(note_for(sp, ch)[0]) - _COL_LAG)
                     for ch in codec.ALPHABET])


def _similarity(banded, bank, sig_mean, durs, veto):
    ncols = banded.shape[1]
    sims = np.full((ncols, len(codec.ALPHABET)), -1e9)
    energy = banded.sum(axis=0)
    ref = np.percentile(energy, 75) + 1e-12
    cum = np.concatenate([[0.0], np.cumsum(energy)])
    for si in range(len(codec.ALPHABET)):
        d = int(durs[si]); last = ncols - d
        if last < 0:
            continue
        off = np.round(np.linspace(0, d - 1, SIG_FRAMES)).astype(int)
        starts = np.arange(last + 1)
        block = np.transpose(banded[:, starts[:, None] + off[None, :]], (1, 0, 2))
        peak = block.max(axis=(1, 2), keepdims=True)
        vec = np.log1p(100.0 * block / (peak + 1e-9)).reshape(len(starts), -1)
        vec /= np.linalg.norm(vec, axis=1, keepdims=True) + 1e-9
        vec -= sig_mean
        vec /= np.linalg.norm(vec, axis=1, keepdims=True) + 1e-9
        # Cheap insurance: silent spans normalise to all-zero rows, and any
        # non-finite value here would poison the dot product below.
        # (Note: numpy still emits a "divide by zero encountered in matmul"
        # RuntimeWarning on this line even though the similarity matrix comes
        # out fully finite — verified. generate.py warns identically. Cosmetic,
        # not yet explained; do not read it as a numerical failure.)
        vec = np.nan_to_num(vec, nan=0.0, posinf=0.0, neginf=0.0)
        span = (cum[starts + d] - cum[starts]) / d
        sims[:last + 1, si] = np.where(span < veto * ref, -1e9, vec @ bank[si])
    return sims


def decode(audio, species_key, checkpoint, margin=None, penalty=None,
           veto=None, return_score=False):
    """audio -> text, by Viterbi over the WHOLE signal.

    Never commits to note boundaries: the encoder asks for deep gaps but the
    trained model smooths its own output, so thresholding energy merges and
    splits notes. Instead we search for the sequence of motifs and gaps whose
    concatenation best explains the entire signal, using each motif's known
    duration and the encoder's own gap ranges as constraints.
    """
    sp = SP.get(species_key)
    given = {"margin": margin, "penalty": penalty, "veto": veto}
    s = decode_settings(sp, [k for k, v in given.items() if v is None])
    mrg = s["margin"] if margin is None else margin
    pen = s["penalty"] if penalty is None else penalty
    vet = s["veto"] if veto is None else veto

    bank, sig_mean = template_bank(sp, checkpoint)
    banded = _banded(np.ascontiguousarray(audio, dtype=np.float64), sp)
    durs = symbol_durations(sp)
    sims = _similarity(banded, bank, sig_mean, durs, vet)
    ncols = banded.shape[1]

    lag = _COL_LAG
    g_lo = lag + int(s["gap"][0] * SAMPLE_RATE / HOP)
    g_hi = lag + int(s["gap"][1] * SAMPLE_RATE / HOP) + 2
    w_lo = lag + int(s["pause"][0] * SAMPLE_RATE / HOP)
    w_hi = lag + int(s["pause"][1] * SAMPLE_RATE / HOP) + 2

    NEG = -1e18
    dp = np.full(ncols + w_hi + 2, NEG)
    dp[:max(ncols, 1)] = 0.0            # a message may begin at any column
    back = {}
    best_end, best_tail = NEG, None
    for t in range(ncols):
        if dp[t] <= NEG / 2:
            continue
        base = dp[t]
        for si in range(len(codec.ALPHABET)):
            sim = sims[t, si]
            if sim <= -1e8:
                continue
            # Duration-weighted, plus a fixed per-symbol cost. Without both, the
            # search invents letters: every extra note adds positive similarity.
            score = base + (sim - mrg) * int(durs[si]) - pen
            end = t + int(durs[si])
            if score > best_end:
                best_end, best_tail = score, (t, si)
            for lo, hi, is_space in ((end + g_lo, end + g_hi, False),
                                     (end + w_lo, end + w_hi, True)):
                hi = min(hi, len(dp))
                if lo >= hi:
                    continue
                view = dp[lo:hi]
                upd = score > view
                if upd.any():
                    view[upd] = score
                    for p in (np.nonzero(upd)[0] + lo):
                        back[int(p)] = (t, si, is_space)

    if best_tail is None:
        return ("", 0.0) if return_score else ""
    out, (t, si) = [codec.ALPHABET[best_tail[1]]], best_tail
    while t in back:
        pt, psi, space = back[t]
        if space:
            out.append(" ")
        out.append(codec.ALPHABET[psi])
        t = pt
    text = "".join(reversed(out))
    return (text, best_end / max(ncols, 1)) if return_score else text


def is_message(audio, species_key, checkpoint, threshold=None):
    """Does this carry a message, or is it just a bird?

    The decoder is closed-set — it always returns its best explanation — so a
    wild recording yields confident nonsense. What separates the two is the
    WHOLE-SIGNAL score per column, never the best single note: our motifs ARE
    real notes of this species, so a real bird contains notes resembling them.
    What a real bird does not do is lay them end to end at exactly our motif
    durations with gaps in exactly our permitted ranges.
    """
    sp = SP.get(species_key)
    thr = (decode_settings(sp, ["threshold"])["threshold"]
           if threshold is None else threshold)
    if thr is None:
        raise SystemExit(f"{species_key}: no calibrated threshold yet — run the "
                         f"calibration before asking whether audio is a message")
    text, score = decode(audio, species_key, checkpoint, return_score=True)
    return score >= thr, text, score
