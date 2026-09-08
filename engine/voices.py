"""
Birdsong voices — MILESTONE A: make the modem sound like a bird.

KEY STRUCTURAL IDEA (read this before the code):

  birdsong_codec.py owns the PROTOCOL — the fixed rule "symbol X = frequency Y".
  This file owns the VOICE — how that frequency is *rendered* into sound.

  The protocol never changes. A voice is a swappable rendering layer on top of
  it. A nightingale and a crow send the SAME frequency for the letter 'a'; they
  just dress it up differently (a pure glide vs. a harsh croak). Because the
  center frequency of each symbol is preserved, the SAME decoder still reads
  every voice — we don't need a different decoder per bird.

  This mirrors the whole app's architecture: keep the stable contract (here, the
  frequency plan) separate from the swappable implementation (the voices).

A "voice" here is app.md §6's "synthesis profile": just a bag of numbers that
describe how one species sings. No audio files involved — pure synthesis.
"""

from dataclasses import dataclass, field

import numpy as np

# Reuse everything from the protocol layer. We do NOT redefine the frequency
# plan — that stays the single source of truth in birdsong_codec.
from birdsong_codec import (
    SAMPLE_RATE, SYMBOL_SECONDS, FADE_SECONDS,
    SYMBOL_TO_FREQ, normalize, decode, char_accuracy, save_wav,
)


# --------------------------------------------------------------------------
# A "synthesis profile": the parameters that define one bird's voice
# --------------------------------------------------------------------------
@dataclass
class Voice:
    name: str
    # Pitch movement WITHIN a single symbol. Real birds rarely hold a flat
    # note — they slur. glide_hz is how far the pitch sweeps; shape is how.
    glide_hz: float = 0.0
    glide_shape: str = "arch"          # "up", "down", or "arch" (rise-then-fall)
    # Warble: a fast wobble on top of the pitch, like a trilling songbird.
    vibrato_hz: float = 0.0
    vibrato_depth: float = 0.0
    # Timbre: which harmonics are present and how loud. [(1, 1.0)] is a pure
    # whistle. Adding (2, 0.4), (3, 0.2) makes it richer/reedier.
    harmonics: list = field(default_factory=lambda: [(1, 1.0)])
    # Roughness: a touch of broadband noise for harsh, croaky birds.
    noise: float = 0.0

    def contour(self, base_freq: float, t: np.ndarray) -> np.ndarray:
        """The instantaneous frequency over time for one symbol.

        Crucially, the contour stays CENTERED on base_freq (the symbol's tone),
        so the decoder's 'which pitch dominates?' still lands on the right
        symbol. Bird character comes from movement *around* that center.
        """
        span = t[-1] if t[-1] > 0 else 1.0
        u = t / span                                # 0..1 across the symbol
        g = self.glide_hz
        if self.glide_shape == "up":
            f = base_freq - g / 2 + g * u
        elif self.glide_shape == "down":
            f = base_freq + g / 2 - g * u
        else:  # "arch": rise then fall, symmetric so the average stays on base
            f = base_freq + (g / 2) * np.sin(np.pi * u)
        if self.vibrato_depth:
            f = f + self.vibrato_depth * np.sin(2 * np.pi * self.vibrato_hz * t)
        return f


# --------------------------------------------------------------------------
# Three hand-authored species. Numbers picked from general knowledge of how
# each bird sounds, then tuned by ear. This is where real reference recordings
# would eventually help us choose better numbers.
# --------------------------------------------------------------------------
VOICES = {
    # Pure liquid whistle that arcs and warbles — the classic "song".
    "nightingale": Voice(
        name="nightingale",
        glide_hz=70, glide_shape="arch",
        vibrato_hz=28, vibrato_depth=18,
        harmonics=[(1, 1.0), (2, 0.25)],
        noise=0.0,
    ),
    # Short, bright, upward chirps with a little airiness.
    "sparrow": Voice(
        name="sparrow",
        glide_hz=90, glide_shape="up",
        vibrato_hz=0, vibrato_depth=0,
        harmonics=[(1, 1.0), (2, 0.4), (3, 0.15)],
        noise=0.04,
    ),
    # Harsh and rough: strong harmonics plus noise = a croak, not a whistle.
    "crow": Voice(
        name="crow",
        glide_hz=40, glide_shape="down",
        vibrato_hz=0, vibrato_depth=0,
        harmonics=[(1, 1.0), (2, 0.7), (3, 0.5), (4, 0.3)],
        noise=0.12,
    ),
}


# --------------------------------------------------------------------------
# Bird-like synthesis: the upgraded job ②
# --------------------------------------------------------------------------
def _envelope(n: int) -> np.ndarray:
    """Amplitude shape of one note: quick attack, gentle decay, clean edges.

    A real chirp swells fast and tails off — not the flat box of a beep. The
    short fades at the very edges still prevent the click we discussed earlier.
    """
    env = np.ones(n)
    attack = int(0.10 * n)
    decay_start = int(0.35 * n)
    env[:attack] = np.linspace(0, 1, attack)                 # fast swell in
    env[decay_start:] = np.linspace(1, 0.55, n - decay_start)  # gentle tail
    fade = int(SAMPLE_RATE * FADE_SECONDS)
    if fade > 0:
        env[:fade] *= np.linspace(0, 1, fade)
        env[-fade:] *= np.linspace(1, 0, fade)
    return env


def synth_symbol(base_freq: float, voice: Voice) -> np.ndarray:
    """Render ONE symbol as a bird-like note at base_freq, in `voice`'s style."""
    n = int(SAMPLE_RATE * SYMBOL_SECONDS)
    t = np.arange(n) / SAMPLE_RATE

    f_t = voice.contour(base_freq, t)
    # A gliding tone's phase is the running total (integral) of its frequency.
    # cumsum is the discrete integral. This is how you make pitch actually move.
    phase = 2 * np.pi * np.cumsum(f_t) / SAMPLE_RATE

    wave = np.zeros(n)
    for mult, amp in voice.harmonics:
        wave += amp * np.sin(mult * phase)      # stack harmonics for timbre
    if voice.noise:
        wave += voice.noise * np.random.randn(n)

    wave *= _envelope(n)
    peak = np.max(np.abs(wave))
    return (wave / peak * 0.9) if peak > 0 else wave   # normalize, leave headroom


def encode_voice(text: str, voice: Voice) -> np.ndarray:
    """text -> bird-like audio, in the given voice. Same protocol, new sound."""
    clean = normalize(text)
    if not clean:
        return np.zeros(0, dtype=np.float32)
    notes = [synth_symbol(SYMBOL_TO_FREQ[s], voice) for s in clean]
    return np.concatenate(notes).astype(np.float32)


# --------------------------------------------------------------------------
# Demo: render the same sentence in every voice and check it still decodes
# --------------------------------------------------------------------------
if __name__ == "__main__":
    message = "the nightingale sings at dusk, and i hear you clearly."
    print(f"message  : {normalize(message)!r}\n")

    for name, voice in VOICES.items():
        samples = encode_voice(message, voice)
        path = f"out/message_{name}.wav"
        save_wav(path, samples)
        decoded = decode(samples)            # SAME decoder for every voice
        acc = char_accuracy(message, decoded) * 100
        print(f"{name:12s} accuracy {acc:5.1f}%   -> {path}")
