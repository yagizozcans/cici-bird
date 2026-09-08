"""
Path B  —  encode text using REAL bird syllables (concatenative synthesis).

Idea: a real nightingale sings from a vocabulary of repeated "syllable" types.
So we:
  1. take a real recording,
  2. auto-chop it into individual syllables,
  3. assign one real syllable to each letter (that's our alphabet),
  4. spell a message by concatenating real syllables,
  5. decode by matching each note back to the known syllable set.

The result genuinely IS a nightingale, because every note is a real recording.
This is the middle path from the table: real-sounding AND still decodable.

Source recording: Common Nightingale (Luscinia megarhynchos), Xeno-canto
XC546355 via Wikimedia Commons, licensed CC BY-SA 4.0. Attribution required.
"""

import numpy as np
from scipy.io import wavfile

from birdsong_codec import SAMPLE_RATE, save_wav

ASSET = "assets/nightingale.wav"
TEMPLATE_SECONDS = 0.14                       # every syllable padded to this length
L = int(TEMPLATE_SECONDS * SAMPLE_RATE)

# Our alphabet for this codec: 26 letters + space. Each letter maps to one real
# syllable; space maps to silence (a gap between phrases, which birds have too).
CHARS = list("abcdefghijklmnopqrstuvwxyz")


def _load_mono(path: str) -> np.ndarray:
    _, x = wavfile.read(path)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = x.astype(np.float32)
    return x / (np.abs(x).max() + 1e-9)


def _segment(x: np.ndarray) -> list:
    """Split the recording into syllables at the silences between notes."""
    frame = int(0.010 * SAMPLE_RATE)
    env = np.array([np.sqrt(np.mean(x[i:i + frame] ** 2))
                    for i in range(0, len(x) - frame, frame)])
    thr = 0.06 * env.max() + 0.5 * np.median(env)
    voiced = env > thr
    segs, i = [], 0
    while i < len(voiced):
        if voiced[i]:
            j = i
            while j < len(voiced) and voiced[j]:
                j += 1
            if (j - i) * frame >= int(0.04 * SAMPLE_RATE):          # min 40 ms
                segs.append(x[i * frame:j * frame])
            i = j
        else:
            i += 1
    return segs


def _fit(seg: np.ndarray) -> np.ndarray:
    """Pad or trim one syllable to exactly L samples, normalized."""
    seg = seg[:L] if len(seg) >= L else np.concatenate([seg, np.zeros(L - len(seg))])
    peak = np.abs(seg).max()
    return (seg / peak * 0.9) if peak > 0 else seg


def build_alphabet() -> dict:
    """Map each letter -> one real nightingale syllable; space -> silence."""
    segs = _segment(_load_mono(ASSET))
    if len(segs) < len(CHARS):
        raise RuntimeError(f"only {len(segs)} syllables, need {len(CHARS)}")
    templates = {ch: _fit(segs[i]) for i, ch in enumerate(CHARS)}
    templates[" "] = np.zeros(L, dtype=np.float32)          # space = a gap
    return templates


# --------------------------------------------------------------------------
def _norm(text: str) -> str:
    ok = set(CHARS) | {" "}
    return "".join(c if c in ok else " " for c in text.lower())


def encode(text: str, templates: dict) -> np.ndarray:
    notes = [templates[c] for c in _norm(text)]
    return np.concatenate(notes).astype(np.float32) if notes else np.zeros(0, np.float32)


def decode(samples: np.ndarray, templates: dict) -> str:
    # Precompute each letter-template's frequency fingerprint (magnitude spectrum).
    letters = CHARS
    ref = {c: np.abs(np.fft.rfft(templates[c])) for c in letters}
    for c in letters:
        ref[c] /= (np.linalg.norm(ref[c]) + 1e-9)

    out = []
    for s in range(0, len(samples) - L + 1, L):
        chunk = samples[s:s + L]
        if np.sqrt(np.mean(chunk ** 2)) < 0.02:            # near-silence -> space
            out.append(" ")
            continue
        fp = np.abs(np.fft.rfft(chunk))
        fp /= (np.linalg.norm(fp) + 1e-9)
        # cosine similarity to each syllable; the closest wins
        best = max(letters, key=lambda c: float(fp @ ref[c]))
        out.append(best)
    return "".join(out)


def accuracy(original: str, decoded: str) -> float:
    a = _norm(original)
    if not a:
        return 1.0
    return sum(x == y for x, y in zip(a, decoded)) / len(a)


if __name__ == "__main__":
    templates = build_alphabet()
    print(f"built alphabet from {len(CHARS)} real nightingale syllables\n")

    message = "the nightingale sings at dusk and i hear you clearly"
    samples = encode(message, templates)
    save_wav("out/message_real_nightingale.wav", samples)
    decoded = decode(samples, templates)

    print(f"original : {_norm(message)!r}")
    print(f"decoded  : {decoded!r}")
    print(f"accuracy : {accuracy(message, decoded)*100:.1f}%")
    print(f"duration : {len(samples)/SAMPLE_RATE:.2f}s")
    print("wrote    : out/message_real_nightingale.wav  (REAL bird syllables)")
