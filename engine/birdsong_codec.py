"""
Birdsong codec — MILESTONE 1: a plain "modem".

This is the very first version of the encode/decode engine from app.md §4.
It is deliberately NOT bird-like yet. Its only job is to prove the round trip:

        text  ->  audio (.wav)  ->  text

...survives with high accuracy. Once we trust that, we make it sound like a bird.

Mental model: this is exactly a modem / touch-tone dialer. Each character is
sent as one distinct pure tone (a "motif" in the doc's language). To read the
message back, we chop the audio into fixed-length slices and ask, for each slice,
"which tone is this?" using the FFT.

Nothing here needs any library beyond numpy + scipy, both already installed.
"""

import numpy as np
from scipy.io import wavfile

# --------------------------------------------------------------------------
# 1. AUDIO + ALPHABET CONFIGURATION
# --------------------------------------------------------------------------
# A digital audio file is just a long list of numbers ("samples"): the height
# of the sound wave measured SAMPLE_RATE times per second. 22050 samples/sec is
# plenty for the tones we use and keeps files small (a doc requirement, §4.4).
SAMPLE_RATE = 22050          # samples per second
SYMBOL_SECONDS = 0.12        # how long each character's tone lasts
FADE_SECONDS = 0.005         # tiny fade in/out per tone — see note in synth()

# The symbol alphabet (job ① from the plan). We start with plain characters.
# Anything not in here gets normalized away before encoding.
ALPHABET = list("abcdefghijklmnopqrstuvwxyz .,'?")

# Each symbol gets its own frequency (its "motif"). We space them far apart so
# the decoder can tell them apart easily. This is Frequency-Shift Keying (FSK).
BASE_FREQ = 800.0            # Hz, the tone for the first symbol
FREQ_STEP = 120.0            # Hz between neighbouring symbols

# Precompute symbol <-> frequency lookup tables.
SYMBOL_TO_FREQ = {sym: BASE_FREQ + i * FREQ_STEP for i, sym in enumerate(ALPHABET)}
FREQS = np.array([SYMBOL_TO_FREQ[s] for s in ALPHABET])


# --------------------------------------------------------------------------
# 2. TEXT NORMALIZATION  (job ①)
# --------------------------------------------------------------------------
def normalize(text: str) -> str:
    """Fold input down to only the symbols our alphabet supports.

    Real messaging (§4.1) does STT then normalization. We skip STT for now and
    just clean the text: lowercase, and replace unsupported characters with a
    space so the message stays roughly readable instead of silently vanishing.
    """
    allowed = set(ALPHABET)
    return "".join(ch if ch in allowed else " " for ch in text.lower())


# --------------------------------------------------------------------------
# 3. SYNTHESIS: symbols -> audio  (job ②)
# --------------------------------------------------------------------------
def _tone(freq: float) -> np.ndarray:
    """Generate one symbol's worth of audio: a pure sine wave at `freq`."""
    n = int(SAMPLE_RATE * SYMBOL_SECONDS)
    t = np.arange(n) / SAMPLE_RATE            # time in seconds for each sample
    wave = np.sin(2 * np.pi * freq * t)       # the sine wave — the actual tone

    # Fade the first/last few milliseconds in and out. Without this, the wave
    # starts and stops abruptly at a non-zero value, which produces an audible
    # "click" (a broadband pop that also confuses the FFT). This envelope is a
    # small but real piece of audio-engineering hygiene.
    fade = int(SAMPLE_RATE * FADE_SECONDS)
    if fade > 0:
        ramp = np.linspace(0, 1, fade)
        wave[:fade] *= ramp
        wave[-fade:] *= ramp[::-1]
    return wave


def encode(text: str) -> np.ndarray:
    """text -> audio samples (float32 in range [-1, 1])."""
    clean = normalize(text)
    if not clean:
        return np.zeros(0, dtype=np.float32)
    tones = [_tone(SYMBOL_TO_FREQ[sym]) for sym in clean]
    return np.concatenate(tones).astype(np.float32)


# --------------------------------------------------------------------------
# 4. ANALYSIS: audio -> symbols  (job ③)
# --------------------------------------------------------------------------
_BAND_HALF_WIDTH = FREQ_STEP * 0.45   # a bit under half the symbol spacing


def _best_candidate(chunk: np.ndarray) -> int:
    """Return the index of the symbol whose frequency band has the most energy.

    IMPORTANT DESIGN POINT: we do NOT ask "what's the single loudest frequency
    anywhere in this chunk?" — that's a blind global search, and it can be
    fooled by broadband noise/rumble that was never a valid symbol in the
    first place (this bit us once a trained, noisier voice was introduced).

    Instead, like a real telephone's DTMF touch-tone decoder (the Goertzel
    algorithm), we only ever compare energy near the fixed set of known
    candidate frequencies (FREQS) and pick whichever is strongest. Anything
    clearly outside that known set — hiss, rumble, room noise — is
    structurally ignored, no matter how loud it is.

    We sum energy across a small BAND around each candidate, not one exact
    bin: an expressive voice can glide/vibrato its pitch a little around the
    target (see voices.py), which spreads energy across nearby frequencies
    rather than concentrating it on one bin. A band tolerates that wobble
    while still rejecting anything far from every known candidate.
    """
    window = np.hanning(len(chunk))
    spectrum = np.abs(np.fft.rfft(chunk * window))
    bin_freqs = np.fft.rfftfreq(len(chunk), d=1 / SAMPLE_RATE)
    energies = [spectrum[np.abs(bin_freqs - f) <= _BAND_HALF_WIDTH].sum() for f in FREQS]
    return int(np.argmax(energies))


def decode(samples: np.ndarray) -> str:
    """audio samples -> text. Inverse of encode()."""
    n = int(SAMPLE_RATE * SYMBOL_SECONDS)
    if n == 0 or len(samples) < n:
        return ""
    out = []
    # Milestone-1 simplification: because WE generated the audio, every symbol
    # is exactly `n` samples long, so we can slice it into equal pieces. Real
    # received audio won't be this tidy — segmentation (§4.1) becomes its own
    # problem later. Naming the shortcut now so we remember to remove it.
    for start in range(0, len(samples) - n + 1, n):
        chunk = samples[start:start + n]
        out.append(ALPHABET[_best_candidate(chunk)])
    return "".join(out)


# --------------------------------------------------------------------------
# 5. WAV FILE I/O  (so you can actually listen)
# --------------------------------------------------------------------------
def save_wav(path: str, samples: np.ndarray) -> None:
    """Write float samples [-1,1] to a 16-bit WAV file."""
    pcm = np.clip(samples, -1, 1)
    wavfile.write(path, SAMPLE_RATE, (pcm * 32767).astype(np.int16))


def load_wav(path: str) -> np.ndarray:
    """Read a 16-bit WAV back to float samples [-1,1]."""
    _, pcm = wavfile.read(path)
    return pcm.astype(np.float32) / 32767


# --------------------------------------------------------------------------
# 6. MEASUREMENT: the "release gate"  (job ④)
# --------------------------------------------------------------------------
def char_accuracy(original: str, decoded: str) -> float:
    """Fraction of characters that survived the round trip, 0.0–1.0.

    overview.md sets ~90% comprehension as the floor below which the messaging
    premise breaks. This function is how we hold ourselves to that number.
    """
    a = normalize(original)
    if not a:
        return 1.0
    matches = sum(1 for x, y in zip(a, decoded) if x == y)
    return matches / len(a)


def edit_distance_accuracy(original: str, decoded: str) -> float:
    """Alignment-robust accuracy via Levenshtein (edit) distance.

    char_accuracy() above does a position-by-position zip comparison, which
    silently assumes original and decoded are the same length and stay in
    lockstep. That assumption held for the fixed-grid decoder (one chunk in,
    one symbol out, always — see decode() above) but breaks the moment a
    decoder can DROP or INSERT a symbol (e.g. a segmentation-based decoder
    that miscounts note boundaries): one missing character shifts every
    later position out of alignment, and char_accuracy craters to near-zero
    even for an otherwise near-perfect transcription.

    Edit distance finds the cheapest sequence of insert/delete/substitute
    operations that turns one string into the other — the same idea speech
    recognition and OCR systems use to score transcripts fairly. We return
    1 - (edits / longer_length), an intuitive 0..1 similarity score.
    """
    a, b = normalize(original), decoded
    if not a and not b:
        return 1.0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    distance = prev[len(b)]
    return 1 - distance / max(len(a), len(b))


# --------------------------------------------------------------------------
# 7. DEMO: run this file directly to see the full round trip
# --------------------------------------------------------------------------
if __name__ == "__main__":
    message = "the nightingale sings at dusk, and i hear you clearly."

    samples = encode(message)
    save_wav("out/message.wav", samples)
    decoded = decode(samples)

    print(f"original : {normalize(message)!r}")
    print(f"decoded  : {decoded!r}")
    print(f"accuracy : {char_accuracy(message, decoded) * 100:.1f}%")
    print(f"duration : {len(samples) / SAMPLE_RATE:.2f}s")
    print("wrote    : out/message.wav  (open it to hear the 'modem')")
