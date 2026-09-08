"""
A+  —  how close can PURE SYNTHESIS get?

This is an upgraded nightingale that adds the three things milestone A was
missing, the things that make real birdsong sound alive:

  1. A second voice (the "syrinx"): real birds have a two-sided voice box and
     can sing two pitches at once. We add a quieter partner voice.
  2. A fast trill (vibrato + amplitude flutter): the rapid warble of a songbird.
  3. Per-note variation: real birds never sing a note identically twice, so we
     jitter each note slightly. Identical repetition is a big "fake" giveaway.

WATCH THE TENSION IN THE CODE: every one of these makes it sound more real AND
threatens the decoder. So each is kept *subordinate* to the primary tone at the
symbol's frequency (secondary voice quieter, jitter small, center fixed). That
compromise is the whole story of pure synthesis: realism is capped by the need
to stay decodable.
"""

import numpy as np
from birdsong_codec import (
    SAMPLE_RATE, SYMBOL_SECONDS, FADE_SECONDS,
    SYMBOL_TO_FREQ, normalize, decode, char_accuracy, save_wav,
)


def _envelope(n: int) -> np.ndarray:
    env = np.ones(n)
    attack, decay = int(0.10 * n), int(0.35 * n)
    env[:attack] = np.linspace(0, 1, attack)
    env[decay:] = np.linspace(1, 0.5, n - decay)
    fade = int(SAMPLE_RATE * FADE_SECONDS)
    env[:fade] *= np.linspace(0, 1, fade)
    env[-fade:] *= np.linspace(1, 0, fade)
    return env


def synth_symbol_plus(base_freq: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)          # deterministic per-note variety
    n = int(SAMPLE_RATE * SYMBOL_SECONDS)
    t = np.arange(n) / SAMPLE_RATE
    u = t / t[-1]

    # --- per-note jitter (kept small so the center stays on base_freq) ---
    glide = 80 + rng.uniform(-20, 20)
    trill_hz = rng.uniform(30, 55)
    trill_depth = 22 + rng.uniform(-6, 6)

    # --- primary voice: arched glide + trill, centered on the symbol's tone ---
    f1 = base_freq + (glide / 2) * np.sin(np.pi * u) + trill_depth * np.sin(2 * np.pi * trill_hz * t)
    phase1 = 2 * np.pi * np.cumsum(f1) / SAMPLE_RATE
    primary = np.sin(phase1) + 0.30 * np.sin(2 * phase1)   # + one harmonic

    # --- secondary "syrinx" voice: a real second pitch, but kept quiet so it
    #     never out-votes the primary in the decoder (protecting the release gate)
    f2 = base_freq * 1.5 + 15 * np.sin(2 * np.pi * (trill_hz * 0.8) * t)  # a fifth above
    phase2 = 2 * np.pi * np.cumsum(f2) / SAMPLE_RATE
    secondary = 0.28 * np.sin(phase2)

    wave = primary + secondary
    wave *= (1 + 0.35 * np.sin(2 * np.pi * (trill_hz * 2) * t))   # amplitude flutter
    wave *= _envelope(n)

    peak = np.max(np.abs(wave))
    return (wave / peak * 0.9) if peak > 0 else wave


def encode_plus(text: str) -> np.ndarray:
    clean = normalize(text)
    notes = [synth_symbol_plus(SYMBOL_TO_FREQ[s], seed=i) for i, s in enumerate(clean)]
    return np.concatenate(notes).astype(np.float32) if notes else np.zeros(0, np.float32)


if __name__ == "__main__":
    message = "the nightingale sings at dusk, and i hear you clearly."
    samples = encode_plus(message)
    save_wav("out/message_nightingale_plus.wav", samples)
    decoded = decode(samples)
    print(f"nightingale+ accuracy {char_accuracy(message, decoded)*100:5.1f}%")
    print("wrote out/message_nightingale_plus.wav")
