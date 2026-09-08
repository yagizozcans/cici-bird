"""
Path B, natural phrasing — fix the "chopped" feeling (Problem 1).

Same real nightingale syllables as concatenative.py, but joined like a bird
actually sings instead of pasted into a rigid grid:

  * NATURAL DURATIONS  — keep each syllable's real length; don't force a fixed slot.
  * SMOOTH EDGES       — a few ms of fade on each note so joins don't click.
  * ORGANIC GAPS       — small, slightly random silences between notes; longer
                          pauses at word breaks, like phrasing.

This removes almost all of the mechanical "cut-up" artifact. What it does NOT
fix is Problem 2 (the note ORDER is still your text, not a natural melody) — and
it costs us easy blind decoding, because the notes are no longer on a fixed grid.
That trade is exactly why app.md §4.3 transmits the decoded text ALONGSIDE the
audio: the audio is the experience, the sent text is the guarantee.
"""

import numpy as np
from scipy.io import wavfile

from birdsong_codec import SAMPLE_RATE, save_wav
from concatenative import _load_mono, _segment, ASSET, CHARS

rng = np.random.default_rng(0)


def _edge_fade(note: np.ndarray, ms: float = 6.0) -> np.ndarray:
    """Taper the first/last few ms so butt-joins don't click."""
    f = int(ms / 1000 * SAMPLE_RATE)
    if len(note) > 2 * f and f > 0:
        note = note.copy()
        note[:f] *= np.linspace(0, 1, f)
        note[-f:] *= np.linspace(1, 0, f)
    return note


def build_natural_alphabet() -> dict:
    """Letter -> a real syllable at its NATURAL length (no fixed-slot padding)."""
    segs = _segment(_load_mono(ASSET))
    syl = {}
    for i, ch in enumerate(CHARS):
        s = segs[i]
        peak = np.abs(s).max()
        syl[ch] = _edge_fade((s / peak * 0.9) if peak > 0 else s)
    return syl


def _norm(text: str) -> str:
    ok = set(CHARS) | {" "}
    return "".join(c if c in ok else " " for c in text.lower())


def encode_natural(text: str, syl: dict) -> np.ndarray:
    pieces = []
    for c in _norm(text):
        if c == " ":
            pieces.append(np.zeros(int(0.16 * SAMPLE_RATE)))       # phrase pause
            continue
        pieces.append(syl[c])
        gap = rng.uniform(0.015, 0.045)                            # organic micro-gap
        pieces.append(np.zeros(int(gap * SAMPLE_RATE)))
    return np.concatenate(pieces).astype(np.float32) if pieces else np.zeros(0, np.float32)


if __name__ == "__main__":
    syl = build_natural_alphabet()
    message = "the nightingale sings at dusk and i hear you clearly"
    samples = encode_natural(message, syl)
    save_wav("out/message_real_nightingale_natural.wav", samples)
    lens = [len(syl[c]) / SAMPLE_RATE for c in CHARS]
    print(f"syllable lengths: {min(lens):.3f}..{max(lens):.3f}s (varied, not a fixed grid)")
    print(f"duration : {len(samples)/SAMPLE_RATE:.2f}s")
    print("wrote    : out/message_real_nightingale_natural.wav")
