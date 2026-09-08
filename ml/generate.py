"""
ML-4 — GENERATE: turn a text message into real wren-voiced birdsong.

This is the bridge between the two halves of the project:

    engine/birdsong_codec.py   owns the PROTOCOL   (symbol -> frequency)
    ml/model.py + synth.py     owns the VOICE       (trained Bewick's wren timbre)

DESIGN, v4 — FIXED MOTIFS + VITERBI DECODING.

Each letter is ONE FIXED REAL NOTE (a "motif"): a genuine (pitch, loudness)
contour borrowed from the training recordings, always identical for that letter,
sung at that letter's own pitch. Words are phrases of such notes separated by
short articulation gaps; real pauses fall between words.

The decoder does NOT measure pitch, and does NOT cut the audio into notes first.
Both were tried and both are measured dead ends:

  * MEAN PITCH as the carrier: recovering a note's mean pitch from audio has a
    median error of 224Hz, when 120Hz symbol spacing allows only +/-60Hz. No
    estimator fixed it, because a note sweeping ~1400Hz has no well-defined
    frequency inside a 46ms window. Even a decoder cheating with the answer got
    25%.
  * CUT-THEN-CLASSIFY: the encoder asks for -46dB gaps between notes but the
    trained model, smoothing through its GRU and 256-sample noise frames, only
    delivers -13.3dB. A 13dB dip is not reliably distinguishable from the dip
    INSIDE a note, so notes merge and split. A full parameter sweep capped this
    at 79% however it was tuned.

Instead the decoder searches for the sequence of motifs and gaps whose
concatenation best explains the WHOLE signal (Viterbi), using each motif's known
exact duration and the encoder's known gap ranges as constraints. Locally
ambiguous notes get resolved by whether they let the rest of the message line up
— the same reason speech recognizers decode a whole utterance at once instead of
segmenting words first.

The trade this buys: every 'a' now sounds identical. That is affordable because
a Bewick's wren's real song is itself built from repeated motifs.
"""

import sys
import os

import numpy as np
import torch
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "engine"))

from config import SAMPLE_RATE, HOP
from model import DDSPDecoder
from synth import harmonic_synth, filtered_noise
import birdsong_codec as codec

# AMBIENT FLOOR ("comfort noise").
#
# Our old silence gate forced pauses to EXACTLY 0.0, so the background snapped
# on and off around every note. Same reason hard noise gates "pump" in music
# production, and why telephony injects comfort noise instead of dead silence.
#
# Level is defined relative to the NOTE regions, not to peak sample amplitude.
# That distinction matters: referencing peak gave a bed ~34.5dB below the note
# level — inaudible, so the on/off cliff remained. What the ear compares is the
# background DURING notes (the model's own breathy noise component) against the
# background BETWEEN them, so the bed must be set against that same reference.
_AMBIENT_BELOW_NOTES_DB = -22.0     # bed level relative to note-region RMS
_GATE_FADE_S = 0.025                # gentle note->pause fade (was 5ms: too abrupt)
_EDGE_THR = 0.002                   # how far down a note's tails we follow when extracting
_MAX_EDGE = 0.25                    # reject notes that start/end louder than this

# Measured from the real clips: consecutive notes INSIDE a phrase are separated
# by a gap of median 20ms (p25 12ms, p75 78ms) — a real bird articulates each
# note, it does not smear a phrase into one continuous tone. Our earlier version
# glued letters edge-to-edge (0ms gap) plus a crossfade that blended them into
# each other; that is what read as "strict"/"cut"/"doesn't flow": with no
# onset of its own, each note sounded like a slice of the previous one rather
# than a new note. Note this is a MIDDLE GROUND, not a revert — the original
# problem was gaps that were far too long (isolated blips).
# Floor raised from 12ms to 22ms once decode came back: the model's own time
# resolution (256-sample noise frames = 11.6ms) plus the GRU's smoothing means a
# 12ms gap arrives half-filled and the decoder merges the two notes ("love"->"le").
# 22ms still sits right at the real 20ms median, so this costs no audible realism.
# Re-measured 2026-09-08 at the 11.6ms window: p25 14.5ms, median 26.1ms,
# p75 40.6ms (the sharper envelope also RESOLVES 3x more gaps: 893 vs 290).
# The existing range still straddles that median with its floor above the
# model's own 11.6ms time resolution, so it was validated, not changed.
INTER_NOTE_GAP_RANGE = (0.022, 0.055)   # s, straddling the real 26ms median
_GAP_FLOOR = 0.0015                     # loudness dip during the gap (NOT zero:
                                        # zero would trip the silence gate and
                                        # punch a hole in the ambient bed)
WORD_PAUSE_RANGE = (0.10, 0.20)     # real silence, only between words

# Real pitch-contour shapes are used at their FULL NATURAL swing — never
# compressed to fit a decode tolerance. That was the right call: the earlier
# plan of squeezing bird movement down to a ~50Hz budget would have cost the
# realism outright, and the eventual answer (fixed motifs + Viterbi, see the
# module docstring) needs no such compression at all. Realism led, and decode
# followed it rather than the other way round.

_SHAPE_LIBRARY = None


def _build_shape_library():
    """Extract real (pitch-shape, loudness-shape) PAIRS from training data —
    together, from the SAME real note, not independently randomized.

    A synthetic sine-wave wobble and a hand-formula loudness pulse are each
    perfectly regular — that regularity is exactly what reads as "synthesizer"
    rather than "animal." And using them independently throws away something
    real birds don't: pitch and loudness move TOGETHER in a real note (a note
    might swell in loudness exactly as its pitch peaks, say) — a real
    (pitch, loudness) pair preserves that natural correlation; two separate
    random formulas cannot.

    Pitch is DE-MEANED (kept as pure shape) but we ALSO record the mean pitch
    the note was actually sung at. That matters: real note shapes swing a
    median of ~1375Hz around their center. Transplanting such a shape onto a
    far-away base frequency (e.g. our 800Hz letter 'a') drives the pitch
    NEGATIVE — physically meaningless, wildly out of anything the model saw in
    training, so it renders garbage (measured: noise 17x louder than the tone
    at 800Hz). Recording the original mean lets us match each letter to shapes
    that actually lived near that frequency, keeping every note in-distribution.

    Loudness is left in its own natural relative shape; only its peak gets
    rescaled later so overall volume stays controllable across letters.
    Duration is NOT forced to our old symbol-length assumption — each pair
    keeps its own real, natural duration.
    """
    global _SHAPE_LIBRARY
    if _SHAPE_LIBRARY is not None:
        return _SHAPE_LIBRARY

    d = np.load(os.path.join(os.path.dirname(__file__), "feature_cache.npz"))
    f0s, louds = d["f0"], d["loud"]
    frame_rate = SAMPLE_RATE / HOP
    thr = 0.02
    pairs = []
    for f0c, loudc in zip(f0s, louds):
        voiced = loudc > thr           # NOTE: f0 is never exactly 0 in our
        i = 0                          # extractor (it always reports SOME
        while i < len(voiced):         # dominant frequency), so voicing must
            if voiced[i]:               # be judged from LOUDNESS, not f0.
                j = i
                while j < len(voiced) and voiced[j]:
                    j += 1
                dur = (j - i) / frame_rate
                if 0.05 <= dur <= 0.30:          # a natural single-note range
                    # EXTEND outward to recover the note's natural fade-in and
                    # fade-out. The `loudc > thr` test finds only the loud CORE
                    # of a note; cutting there left every borrowed note starting
                    # at ~29% loudness (p90: 76%) and ending at ~23%, so notes
                    # began and ended mid-swing — audibly "cut"/abrupt.
                    max_ext = int(0.03 * frame_rate)          # up to 30ms a side
                    lo, steps = i, 0
                    while (lo > 0 and steps < max_ext
                           and loudc[lo - 1] < loudc[lo] and loudc[lo - 1] > _EDGE_THR):
                        lo -= 1; steps += 1
                    hi, steps = j, 0
                    while (hi < len(loudc) and steps < max_ext
                           and loudc[hi] < loudc[hi - 1] and loudc[hi] > _EDGE_THR):
                        hi += 1; steps += 1

                    seg = f0c[lo:hi].astype(np.float32)
                    mean_f0 = float(seg.mean())
                    f0_seg = seg - mean_f0
                    loud_seg = loudc[lo:hi].astype(np.float32)
                    if np.abs(f0_seg).max() > 1e-3 and loud_seg.max() > 1e-4:
                        loud_seg = loud_seg / loud_seg.max()
                        # Keep only notes whose envelope naturally BEGINS and
                        # ENDS quiet. Some real notes were clipped by the clip
                        # boundary or start abruptly; splicing those in makes an
                        # audible step no crossfade fully hides. 152 of 229 notes
                        # pass, still spanning 2415-7224Hz — full coverage of our
                        # 2800-6520Hz generation range, with variety to spare.
                        if loud_seg[0] <= _MAX_EDGE and loud_seg[-1] <= _MAX_EDGE:
                            pairs.append((f0_seg, loud_seg, mean_f0))
                i = j
            else:
                i += 1
    _SHAPE_LIBRARY = pairs
    return pairs


_MATCH_POOL = 25          # choose randomly among the N closest-pitch real notes

# GENERATION-SIDE FREQUENCY MAP — deliberately different from the codec's.
#
# The codec maps symbols to 800-4400Hz (BASE 800, STEP 120). Measured against
# this trained model, that is the wrong range for THIS bird: a Bewick's wren's
# real notes live at 2293-6174Hz (5th-95th pct, median 4165), and the model
# renders cleanly (noise/harmonic ~0.4) only above ~2800Hz. Below 2400Hz the
# ratio explodes to 17-23x — the bird's genuine buzzy low chatter, not a bug,
# but it means the ENTIRE bottom half of the codec's alphabet was being sung
# in a range this bird has no clean voice for. That was the "alien" timbre and
# the "background noise" both.
#
# So for sound-quality work we re-map the same 32 symbols onto the bird's
# actual singing range, keeping the codec's 120Hz spacing. When we return to
# decoding, the codec's own map will need reconciling with this one.
_GEN_BASE_FREQ = 2800.0
_GEN_FREQ_STEP = 120.0
_GEN_SYMBOL_TO_FREQ = {
    sym: _GEN_BASE_FREQ + i * _GEN_FREQ_STEP for i, sym in enumerate(codec.ALPHABET)
}


# FIXED MOTIF PER SYMBOL — the decisive protocol decision.
#
# Earlier, each letter drew a RANDOM shape from the pool of notes near its
# pitch, and the message rode on the note's MEAN pitch. Measured, that fails
# hard: recovering mean pitch from audio has a median error of 224Hz when the
# alphabet's spacing only allows +/-60Hz, and NO estimator fixes it (weighted
# mean, median, loud-core, trimmed mean: all 193-499Hz). The reason is physical,
# not a bug — a note sweeping ~1400Hz has no well-defined instantaneous
# frequency inside a 46ms analysis window (time/frequency uncertainty). Even a
# decoder allowed to cheat with the known answer only reached 25%.
#
# So the carrier changes. Each symbol gets ONE FIXED real note — its own motif,
# always the same shape, duration and pitch. Decoding stops being "estimate this
# note's pitch to within 60Hz" (a hopeless measurement) and becomes "which of my
# 32 known notes is this?" — template matching against the whole note at once,
# using contour, duration and timbre together. Same principle as
# engine/concatenative.py, which hit 100% with real syllables as the alphabet.
#
# The cost is honest: every 'a' now sounds identical. That is affordable here
# because a Bewick's wren's real song is itself built from REPEATED MOTIFS, so a
# fixed per-letter motif is arguably more true to the species, not less.
_MOTIF_SEED = 20260906
_MOTIF_ASSIGNMENT = None


def _motif_assignment():
    """symbol -> index of its shape in the library, GUARANTEED UNIQUE.

    Picking each letter's shape independently let letters collide: measured,
    'h'/'j', 's'/'u' and 'z'/','/'?' each drew the SAME shape, because adjacent
    letters are only 120Hz apart and therefore have almost identical pools of
    nearest-pitch notes. Colliding letters then differ by nothing but a 120Hz
    offset — indistinguishable to the decoder by construction. Claiming a shape
    exclusively costs nothing (152 notes in the library, 31 symbols needed) and
    makes every letter's motif genuinely its own.
    """
    global _MOTIF_ASSIGNMENT
    if _MOTIF_ASSIGNMENT is not None:
        return _MOTIF_ASSIGNMENT
    pairs = _build_shape_library()
    means = np.array([m for _, _, m in pairs])
    taken, assign = set(), {}
    for ch in codec.ALPHABET:
        base = _GEN_SYMBOL_TO_FREQ[ch]
        rng = np.random.default_rng(_MOTIF_SEED + codec.ALPHABET.index(ch))
        order = [i for i in np.argsort(np.abs(means - base)) if i not in taken]
        pick = int(order[rng.integers(0, min(_MATCH_POOL, len(order)))])
        taken.add(pick)
        assign[ch] = pick
    _MOTIF_ASSIGNMENT = assign
    return assign


def _note_for_symbol(ch: str):
    """This letter's FIXED (f0, loudness-shape) motif — a real borrowed note at
    its own natural duration and swing, chosen from notes ACTUALLY SUNG near
    this letter's target pitch.

    Why frequency-matched rather than any random shape: real note shapes swing
    ~1375Hz median around their center, so grafting an arbitrary shape onto an
    arbitrary base frequency shoved f0 negative and far out of the model's
    training distribution — the actual source of both the "alien" timbre and
    the excess noise. Picking a shape that already lived near this pitch keeps
    the full natural swing while staying somewhere the model knows how to sing.

    Deterministic in `ch` alone: the rng is seeded from the symbol's index, so
    this letter's motif is identical everywhere it appears, in every message.
    That is what makes the template-matching decoder possible.
    """
    pairs = _build_shape_library()
    f0_shape, loud_shape, mean_f0 = pairs[_motif_assignment()[ch]]

    f0 = _GEN_SYMBOL_TO_FREQ[ch] + f0_shape
    # Safety net: pitch can never be negative or sub-avian, whatever the shape.
    f0 = np.maximum(f0, 250.0)
    return f0.astype(np.float32), loud_shape.astype(np.float32)


def _borrow_real_note(ch: str, rng: np.random.Generator):
    """The letter's fixed motif, with only its overall VOLUME jittered.

    Loudness scale is left random on purpose: a bird doesn't sing every note at
    the same volume, and the decoder normalizes each note's signature anyway, so
    volume carries no message and costs no accuracy. Shape stays fixed; only
    amplitude breathes.
    """
    f0, loud_shape = _note_for_symbol(ch)
    return f0, (rng.uniform(0.22, 0.34) * loud_shape).astype(np.float32)


def word_to_contour(word: str, seed: int, with_spans: bool = False):
    """One WORD -> one continuous (f0, loudness) stream. No gaps inside.

    Each letter's note is a REAL borrowed (pitch, loudness) pair at its own
    natural duration — nothing here forces notes toward the old ~120ms
    symbol-length assumption; that was decode-shaped thinking, and decode is
    deliberately set aside for this pass.

    `with_spans` additionally returns [(char, start_frame, end_frame)] for every
    note. Notes here have REAL, unequal durations, so unlike the fixed-grid
    codec there is no arithmetic that recovers when a given letter is sung —
    only the sequencer knows. Anything that has to line text up with this audio
    (a synchronized subtitle, say) needs that from here rather than
    reconstructing it, which would be a second copy of this logic free to drift
    away from the first.
    """
    frame_dt = HOP / SAMPLE_RATE
    f0_parts, loud_parts = [], []
    spans = []
    cursor = 0
    prev_tail_f0 = None
    prev_tail_loud = None

    for i, ch in enumerate(word):
        rng = np.random.default_rng(seed + i * 97)
        f0, loud = _borrow_real_note(ch, rng)

        if prev_tail_f0 is not None:
            # ARTICULATION GAP between notes. Measured in the real clips:
            # consecutive notes inside a phrase are separated by a median 20ms
            # gap (p25 12ms, p75 78ms) — they are distinct, articulated events,
            # not one continuous smear. Gluing letters edge-to-edge (plus a
            # crossfade blending them together) is what made notes feel
            # "strict"/cut instead of flowing: each note lost its own onset.
            #
            # Short gaps are safe here in a way they weren't earlier: with the
            # continuous ambient bed underneath, a 20ms gap reads as natural
            # articulation rather than a dropout to dead silence.
            gap_k = max(2, int(rng.uniform(*INTER_NOTE_GAP_RANGE) / frame_dt))
            gap_f0 = np.linspace(prev_tail_f0, f0[0], gap_k, dtype=np.float32)
            half = gap_k // 2
            gap_loud = np.concatenate([
                np.linspace(prev_tail_loud, _GAP_FLOOR, half, dtype=np.float32),
                np.linspace(_GAP_FLOOR, loud[0], gap_k - half, dtype=np.float32),
            ])
            f0_parts.append(gap_f0)
            loud_parts.append(gap_loud)
            cursor += gap_k

        f0_parts.append(f0)
        loud_parts.append(loud)
        spans.append((ch, cursor, cursor + len(f0)))
        cursor += len(f0)
        prev_tail_f0 = f0[-1]
        prev_tail_loud = loud[-1]

    f0_out = np.concatenate(f0_parts)
    loud_out = np.concatenate(loud_parts)
    return (f0_out, loud_out, spans) if with_spans else (f0_out, loud_out)


def message_to_contour(text: str, seed: int = 0, with_spans: bool = False):
    """text -> (f0, loudness, n_samples, normalized_text).

    Words are continuous phrases (word_to_contour); real silence — a true
    phrase pause — only appears BETWEEN words, matching how a bird phrases.

    With `with_spans`, a fifth element is returned: [(char, start_frame,
    end_frame)] in message time, covering every sung character. Spaces have no
    span — they ARE the phrase pauses between words.
    """
    clean = codec.normalize(text)
    words = clean.split(" ")
    frame_dt = HOP / SAMPLE_RATE

    f0_parts, loud_parts = [], []
    spans = []
    cursor = 0
    for wi, word in enumerate(words):
        if word:
            f0, loud, word_spans = word_to_contour(
                word, seed=seed + wi * 5000, with_spans=True
            )
            f0_parts.append(f0)
            loud_parts.append(loud)
            spans.extend((ch, cursor + a, cursor + b) for ch, a, b in word_spans)
            cursor += len(f0)
        if wi < len(words) - 1:
            rng = np.random.default_rng(seed + wi * 5000 + 1)
            pause_s = rng.uniform(*WORD_PAUSE_RANGE)
            pause_k = max(1, int(pause_s / frame_dt))
            f0_parts.append(np.zeros(pause_k, dtype=np.float32))
            loud_parts.append(np.zeros(pause_k, dtype=np.float32))
            cursor += pause_k

    f0 = np.concatenate(f0_parts) if f0_parts else np.zeros(0, dtype=np.float32)
    loud = np.concatenate(loud_parts) if loud_parts else np.zeros(0, dtype=np.float32)
    n_samples = len(f0) * HOP
    if with_spans:
        return f0, loud, n_samples, clean, spans
    return f0, loud, n_samples, clean


# HIGH-PASS FILTER: real training clips have essentially ZERO energy below
# 300Hz regardless of pitch (measured 0.0-0.6%), so anything the model emits
# down there is guaranteed artifact/rumble, never real bird content.
_HPF = butter(4, 300, btype="highpass", fs=SAMPLE_RATE, output="sos")

# Caches are keyed BY CHECKPOINT PATH, not just "loaded / not loaded".
#
# The first version cached a single net and a single template bank, so passing a
# different checkpoint after the first call silently returned the OLD model —
# which would have made every "is the retrained model better?" comparison
# meaningless while looking like it worked. Any cache whose key omits something
# the value depends on is a landmine; here the value depends on the checkpoint,
# so the checkpoint belongs in the key. Templates are cached alongside the net
# because they are RENDERED BY it: a new model means new motif signatures.
_NETS = {}
_BANKS = {}


def _load_net(checkpoint: str = "checkpoints/wren.pt"):
    if checkpoint not in _NETS:
        state = torch.load(checkpoint, map_location="cpu")
        # Infer the hidden width from the weights so checkpoints of different
        # sizes load without the caller having to remember which is which.
        hidden = state["amp_head.weight"].shape[1]
        # Also infer the number of conditioning channels: 2-input checkpoints
        # predate centroid conditioning and must keep loading unchanged.
        n_in = state["encode.0.weight"].shape[1]
        net = DDSPDecoder(hidden=hidden, n_in=n_in)
        net.load_state_dict(state)
        net.eval()
        _NETS[checkpoint] = net
    return _NETS[checkpoint]


def _render(f0_np: np.ndarray, loud_np: np.ndarray, net) -> np.ndarray:
    """(f0, loudness) contour -> audio, through the trained wren voice.

    Factored out so the decoder's TEMPLATES are rendered by the exact same path
    as real messages. If templates were built any other way, we'd be matching
    against notes the encoder never actually produces.
    """
    n_samples = len(f0_np) * HOP
    f0 = torch.tensor(f0_np)[None]
    loud = torch.tensor(loud_np)[None]
    with torch.no_grad():
        amp, harm, noise = net(f0, loud)
        audio = (harmonic_synth(f0, amp, harm, n_samples)[0].numpy()
                 + filtered_noise(noise, n_samples)[0].numpy())
    return sosfiltfilt(_HPF, audio).astype(np.float32)


def generate(text: str, checkpoint: str = "checkpoints/wren.pt", seed: int = 0,
             ambient_db: float = _AMBIENT_BELOW_NOTES_DB,
             with_spans: bool = False):
    f0_np, loud_np, n_samples, clean, spans = message_to_contour(
        text, seed=seed, with_spans=True
    )
    audio = _render(f0_np, loud_np, _load_net(checkpoint))
    sos = _HPF

    # GATE the model's own output during intended pauses — it never produces
    # exact digital zero even when fed f0=0/loud=0, and that residual is the
    # model's variable artifact noise, not a natural ambience. The fade is
    # deliberately gentle so notes DECAY into the bed rather than being chopped.
    silent_frames = (loud_np <= 1e-6).astype(np.float32)
    mask = np.repeat(1.0 - silent_frames, HOP)[:len(audio)]
    fade_k = int(_GATE_FADE_S * SAMPLE_RATE) | 1
    mask = np.convolve(mask, np.hanning(fade_k) / np.hanning(fade_k).sum(), mode="same")
    audio = audio * mask

    # ...then lay ONE CONTINUOUS AMBIENT BED across the whole clip, so the
    # background never switches on or off — it is simply always there, the way
    # any real recording behaves.
    is_silent = np.repeat(silent_frames > 0, HOP)[:len(audio)].astype(bool)
    note_rms = float(np.sqrt(np.mean(audio[~is_silent] ** 2))) if (~is_silent).any() else 0.0
    if note_rms > 0:
        bed_rms = note_rms * (10 ** (ambient_db / 20))
        bed = np.random.default_rng(seed).normal(0, 1, len(audio)).astype(np.float32)
        bed = sosfiltfilt(sos, bed).astype(np.float32)          # same 300Hz HPF
        bed *= bed_rms / (np.sqrt(np.mean(bed ** 2)) + 1e-12)
        audio = audio + bed

    if with_spans:
        # Frames -> seconds. HOP samples per frame, at SAMPLE_RATE.
        timed = [(ch, a * HOP / SAMPLE_RATE, b * HOP / SAMPLE_RATE)
                 for ch, a, b in spans]
        return audio, clean, timed
    return audio, clean


# --------------------------------------------------------------------------
# DECODE — motif matching + Viterbi alignment
# --------------------------------------------------------------------------
_STFT_WIN = 256             # analysis window; columns land at HOP spacing
_COL_LAG = _STFT_WIN // HOP - 1   # columns lost at each note's tail (see decode)
SIG_BANDS = 48              # log-spaced frequency bands in a note's signature
SIG_FRAMES = 16             # time steps after duration-normalization
_SIG_EDGES = np.geomspace(500, 9000, SIG_BANDS + 1)

# Both costs price the act of placing a note, so they trade off against each
# other; they were swept jointly on 8 messages and then CHECKED ON 10 MESSAGES
# THE SWEEP NEVER SAW. This pair scored 95.8% on the tuning set and 95.9% on the
# held-out set — the absence of a gap between the two is the point: it says the
# numbers describe the method, not these particular sentences. Several nearby
# settings held up equally well (94.4-95.9% held out), so the optimum is a broad
# plateau rather than a lucky spike.
_MATCH_MARGIN = 0.48        # per-column similarity a note must beat to be placed
_INSERTION_PENALTY = 2.0    # fixed cost of starting a new note
_ENERGY_VETO = 0.20         # min span energy (vs clip p75) to allow a note at all
# Separates a real bird from a real message, at the midpoint of the empty band
# between the two populations. RE-MEASURED 2026-09-08 for the win=256 model
# (wren_best250) over ALL 893 wild recordings — not the 222 this was previously
# calibrated on, because the tail is what a detector lives and dies on: wild
# tops out at +0.1223, the 30 generated messages bottom out at +0.2038, giving
# an equal +0.0408 margin either side and 0/893 false positives, 0/30 misses.
#
# The margin widened from +/-0.0277 to +/-0.0408 without any decoder change.
# Sharper pitch tracking made the model's messages score HIGHER (min +0.1427 ->
# +0.2038) while wild recordings barely moved, so the two populations pulled
# apart on their own.
#
# This number is NOT a property of the algorithm — it belongs to the algorithm
# PLUS a specific model, because the templates it scores against are rendered by
# that model. Run calibrate.py after ANY change to the checkpoint.
_MESSAGE_THRESHOLD = 0.163


def _banded(audio: np.ndarray) -> np.ndarray:
    """Spectrogram pooled into log-spaced bands. Columns are at HOP samples —
    deliberately the SAME rate as the synthesis contour, so a note that is N
    contour frames long is N columns wide here. That alignment is what lets the
    Viterbi decoder below use each motif's exact known duration.
    """
    win = np.hanning(_STFT_WIN)
    ncols = 1 + max(0, (len(audio) - _STFT_WIN) // HOP)
    idx = np.arange(_STFT_WIN)[None, :] + HOP * np.arange(ncols)[:, None]
    mag = np.abs(np.fft.rfft(audio[idx] * win[None, :], axis=1)).T   # (bins, cols)
    freqs = np.fft.rfftfreq(_STFT_WIN, 1 / SAMPLE_RATE)
    out = np.zeros((SIG_BANDS, ncols))
    for b in range(SIG_BANDS):
        sel = (freqs >= _SIG_EDGES[b]) & (freqs < _SIG_EDGES[b + 1])
        if sel.any():
            out[b] = mag[sel].sum(axis=0)
    return out


def _signature(seg: np.ndarray) -> np.ndarray:
    """Compress one note into a fixed-size, loudness-invariant fingerprint.

    A note is a whole gesture: a pitch that sweeps a particular path, over a
    particular duration, with a particular timbre. So we fingerprint the whole
    SPECTROGRAM rather than reducing the note to a single pitch number — that
    reduction is exactly what failed (median 224Hz error against a 60Hz budget).

    Three deliberate normalizations:
      * log-spaced bands — pitch differences matter proportionally, not in Hz
      * time resampled to SIG_FRAMES — compares SHAPE independent of length
      * L2-normalized — a quiet note and a loud note of the same letter match
    """
    if len(seg) < _STFT_WIN:
        seg = np.pad(seg, (0, _STFT_WIN - len(seg)))
    return _sig_from_cols(_banded(seg), 0, None)


def _sig_from_cols(banded: np.ndarray, start: int, ncols) -> np.ndarray:
    """Signature of columns [start, start+ncols) of an already-computed band map."""
    n = banded.shape[1] - start if ncols is None else ncols
    off = np.round(np.linspace(0, max(n - 1, 0), SIG_FRAMES)).astype(int)
    block = banded[:, start + off]
    vec = np.log1p(100.0 * block / (block.max() + 1e-9)).ravel()
    return (vec / (np.linalg.norm(vec) + 1e-9)).astype(np.float64)


_SIG_MEAN = None


def _discriminative(sig: np.ndarray) -> np.ndarray:
    """Strip the part every bird note has in common; keep only what differs.

    Raw signatures are non-negative spectrograms of notes from ONE bird, so they
    are all strongly correlated: measured, every template sat at cosine ~0.93 to
    its nearest neighbour, i.e. 93% of the match score was just "this is a wren
    note" and only 7% was "this is the letter K". Subtracting the mean template
    removes that shared component and re-normalizes what's left, so the
    comparison spends its whole dynamic range on the differences that identify
    the letter. Same idea as mean-centering before PCA, or as subtracting the
    background before matched-filtering a faint signal.
    """
    if _SIG_MEAN is None:
        return sig
    v = sig - _SIG_MEAN
    return (v / (np.linalg.norm(v) + 1e-9)).astype(np.float64)


def _template_bank(checkpoint: str = "checkpoints/wren.pt") -> np.ndarray:
    """One signature per symbol — what each letter's motif actually sounds like.

    Each template is rendered through _render(), the same function generate()
    uses, so we are matching against notes the encoder genuinely produces
    rather than against an idealized model of them. Silence padding either side
    lets the model's GRU settle, mimicking a note's context inside a word.
    """
    global _SIG_MEAN
    if checkpoint in _BANKS:
        _SIG_MEAN = _BANKS[checkpoint][1]      # restore this bank's centering
        return _BANKS[checkpoint][0]
    _SIG_MEAN = None                           # build raw sigs uncentered first
    net = _load_net(checkpoint)
    pad = 20                                   # frames of silence on each side
    sigs = []
    for ch in codec.ALPHABET:
        f0, loud_shape = _note_for_symbol(ch)
        z = np.zeros(pad, dtype=np.float32)
        audio = _render(np.concatenate([z, f0, z]),
                        np.concatenate([z, 0.28 * loud_shape, z]), net)
        sigs.append(_signature(audio[pad * HOP:(pad + len(f0)) * HOP]))
    raw = np.stack(sigs)
    _SIG_MEAN = raw.mean(axis=0)
    bank = np.stack([_discriminative(s) for s in raw]).astype(np.float64)
    _BANKS[checkpoint] = (bank, _SIG_MEAN)
    return bank


def _symbol_durations() -> np.ndarray:
    """Each motif's exact length in spectrogram columns. Known, because every
    letter's note is fixed — this is the constraint the Viterbi decoder runs on."""
    return np.array([max(4, len(_note_for_symbol(ch)[0]) - 3) for ch in codec.ALPHABET])


def _similarity_matrix(banded: np.ndarray, bank: np.ndarray, veto: float) -> np.ndarray:
    """sim[t, s] = how well symbol s's motif explains the audio starting at column t.

    Computed for every (start, symbol) pair at once. Because each symbol has a
    FIXED duration, the columns a candidate note would occupy are a fixed offset
    pattern from t, so the whole column of starts is one vectorized gather.
    """
    durs = _symbol_durations()
    ncols = banded.shape[1]
    sims = np.full((ncols, len(codec.ALPHABET)), -1e9)

    # ENERGY VETO: refuse to place a note where there is essentially no sound.
    # Measured, the decoder's dominant remaining error was inventing a letter
    # inside a WORD PAUSE ('call me when' -> 'callrmerwhen'), because a pause
    # still has an ambient bed whose spectrum matches some motif better than the
    # margin. Note this does NOT contradict the earlier finding that energy is
    # useless for segmentation: inter-note gaps are only -13dB and genuinely
    # ambiguous, but word pauses are GATED to real silence, so energy separates
    # them cleanly. Use the measurement that is reliable, for the job it is
    # reliable for — energy can't find notes, but it can rule out silence.
    energy = banded.sum(axis=0)
    ref = np.percentile(energy, 75) + 1e-12
    cum = np.concatenate([[0.0], np.cumsum(energy)])

    for si in range(len(codec.ALPHABET)):
        d = int(durs[si])
        last = ncols - d
        if last < 0:
            continue
        off = np.round(np.linspace(0, d - 1, SIG_FRAMES)).astype(int)
        starts = np.arange(last + 1)
        block = banded[:, starts[:, None] + off[None, :]]      # (bands, T, FRAMES)
        block = np.transpose(block, (1, 0, 2))                 # (T, bands, FRAMES)
        peak = block.max(axis=(1, 2), keepdims=True)
        vec = np.log1p(100.0 * block / (peak + 1e-9)).reshape(len(starts), -1)
        vec /= np.linalg.norm(vec, axis=1, keepdims=True) + 1e-9
        vec -= _SIG_MEAN
        vec /= np.linalg.norm(vec, axis=1, keepdims=True) + 1e-9
        span_energy = (cum[starts + d] - cum[starts]) / d
        sims[:last + 1, si] = np.where(span_energy < veto * ref,
                                       -1e9, vec @ bank[si])
    return sims


def decode_natural(audio: np.ndarray, checkpoint: str = "checkpoints/wren.pt",
                   penalty: float = None, margin: float = None,
                   veto: float = None, return_score: bool = False):
    """audio -> text, by VITERBI decoding rather than cut-then-classify.

    Why not just find the notes and classify each one: measured, the encoder
    asks for -46dB gaps between notes but the trained model only delivers
    -13.3dB (its GRU memory and 256-sample noise frames smooth its own output).
    A 13dB dip is not reliably distinguishable from the dip INSIDE a note, so
    energy thresholding merges notes and splits others — capped at 79% however
    it is tuned, which a full parameter sweep confirmed.

    So we never commit to boundaries. Instead we search for the sequence of
    motifs and gaps whose concatenation best explains the ENTIRE signal, using
    each motif's known exact duration plus the encoder's known gap ranges as
    constraints. A note that is locally ambiguous gets resolved by whether it
    lets the rest of the message line up. This is why speech recognizers decode
    with Viterbi over a whole utterance instead of segmenting words first — and
    it is a pure decoder-side change, so it cannot disturb the audio at all.
    """
    pen = _INSERTION_PENALTY if penalty is None else penalty
    mrg = _MATCH_MARGIN if margin is None else margin
    bank = _template_bank(checkpoint)
    banded = _banded(np.ascontiguousarray(audio, dtype=np.float64))
    sims = _similarity_matrix(banded, bank, _ENERGY_VETO if veto is None else veto)
    durs = _symbol_durations()
    ncols = banded.shape[1]

    # Gap budgets straight from the encoder's own constants — the two sides
    # share one explicit contract about what a gap and a word pause mean.
    # _COL_LAG corrects a real off-by-three. A note spanning contour frames
    # [a,b) yields only columns a..b-4, because a column needs a FULL 256-sample
    # window inside the note (_STFT_WIN/HOP - 1 = 3 columns are lost at the
    # tail). So advancing by dur_cols alone lands 3 columns early, and the true
    # 55ms gap needed a step of 21 columns while the range only allowed 18 —
    # every long gap was unreachable, permanently misaligning the rest of the
    # message. Window length is not free: it costs you the end of every note.
    lag = _COL_LAG
    g_lo, g_hi = (lag + int(INTER_NOTE_GAP_RANGE[0] * SAMPLE_RATE / HOP),
                  lag + int(INTER_NOTE_GAP_RANGE[1] * SAMPLE_RATE / HOP) + 2)
    w_lo, w_hi = (lag + int(WORD_PAUSE_RANGE[0] * SAMPLE_RATE / HOP),
                  lag + int(WORD_PAUSE_RANGE[1] * SAMPLE_RATE / HOP) + 2)

    NEG = -1e18
    # A message may BEGIN at any column, not only at column 0. Forcing the first
    # note to start exactly at sample 0 and the last to end within 2 columns of
    # the file's end meant that on audio whose structure didn't happen to tile
    # that way, NO complete path existed and the decoder returned "" — which is
    # what several wild clips did. Real captured audio has leading and trailing
    # silence, so the rigid version would have failed in the app too. Allowing a
    # free start also lets the search abandon a bad prefix and restart, which is
    # strictly better: an unexplainable stretch now costs 0 instead of poisoning
    # everything after it.
    dp = np.full(ncols + w_hi + 2, NEG)
    dp[:max(ncols, 1)] = 0.0
    back = {}
    best_end, best_tail = NEG, None

    for t in range(ncols):
        if dp[t] <= NEG / 2:
            continue
        base = dp[t]
        for si in range(len(codec.ALPHABET)):
            s = sims[t, si]
            if s <= -1e8:
                continue
            # Score is weighted by DURATION, and pays a fixed cost per symbol.
            # Without both, the search is biased toward inventing letters: every
            # extra note contributes another positive similarity, so the best
            # "explanation" of a 26-character message came back 40 letters long.
            # Weighting by columns covered makes rival segmentations comparable
            # (they all have to explain the same total time), and the insertion
            # penalty prices the act of starting a new note at all. Standard ASR
            # practice — the same role a word-insertion penalty plays there.
            score = base + (s - mrg) * int(durs[si]) - pen
            end = t + int(durs[si])
            if score > best_end:                  # the message may stop anywhere
                best_end, best_tail = score, (t, si)
            for lo, hi, sp in ((end + g_lo, end + g_hi, False),
                               (end + w_lo, end + w_hi, True)):
                hi = min(hi, len(dp))
                if lo >= hi:
                    continue
                view = dp[lo:hi]
                upd = score > view
                if upd.any():
                    view[upd] = score
                    for p in (np.nonzero(upd)[0] + lo):
                        back[int(p)] = (t, si, sp)

    if best_tail is None:
        return ("", 0.0) if return_score else ""
    out, (t, si) = [codec.ALPHABET[best_tail[1]]], best_tail
    while t in back:
        prev_t, prev_si, space = back[t]
        if space:
            out.append(" ")
        out.append(codec.ALPHABET[prev_si])
        t = prev_t
    text = "".join(reversed(out))
    return (text, best_end / max(ncols, 1)) if return_score else text


def is_message(audio: np.ndarray, threshold: float = _MESSAGE_THRESHOLD):
    """Does this recording actually CARRY a message, or is it just a bird?

    The decoder is closed-set: Viterbi always returns its best explanation, so
    feeding it a wild recording yields confident-looking nonsense. Something has
    to decide whether to believe the text at all — in the app this is exactly the
    Messaging / Identification fork (app.md §9).

    The statistic that works is the WHOLE-SIGNAL Viterbi score per column, not
    how well the best single note matched. Measured, peak note similarity does
    NOT separate the two (real wren clips reach 0.568 against our messages'
    0.489) — and that is not a flaw, it is the point: our motifs ARE real wren
    notes, so a real wren naturally contains notes resembling them. What a real
    bird does NOT do is lay those notes end to end at exactly our motif
    durations, separated by gaps in exactly our permitted ranges, all the way
    through the clip. Being a message is a property of the whole sequence, not
    of any note in it.
    """
    text, score = decode_natural(audio, return_score=True)
    return score >= threshold, text, score


if __name__ == "__main__":
    message = sys.argv[1] if len(sys.argv) > 1 else "let's go outside!"
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    audio, clean = generate(message, seed=seed)

    out_path = "out/wren_message.wav"
    sf.write(out_path, audio, SAMPLE_RATE)

    decoded = decode_natural(audio)
    print(f"original : {clean!r}")
    print(f"decoded  : {decoded!r}")
    print(f"positional accuracy : {codec.char_accuracy(clean, decoded)*100:5.1f}%")
    print(f"edit-distance accur.: {codec.edit_distance_accuracy(clean, decoded)*100:5.1f}%")
    print(f"duration : {len(audio)/SAMPLE_RATE:.2f}s")
    print(f"wrote    : {out_path}")
