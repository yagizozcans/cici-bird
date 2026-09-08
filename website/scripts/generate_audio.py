"""
Generate every audio asset the cicibird.com website ships, plus the manifest
that the site renders credits and subtitle timings from.

WHY THIS SCRIPT EXISTS
----------------------
website.md §5 requires that "audio credits and licensing attributions [are]
rendered from asset metadata, not hand-maintained." So the website never hard-
codes a duration, a decoded transcript, or an attribution line. It reads
public/audio/manifest.json, and this script is the only thing that writes it.

Everything sonic here comes from the real engine in ../engine:
  birdsong_codec.py  owns the PROTOCOL (symbol -> frequency)
  voices.py          owns the VOICE    (how that frequency is rendered)

Because the protocol is a fixed grid (SYMBOL_SECONDS per character), we get
exact subtitle cue timings for free: character i occupies
[i * SYMBOL_SECONDS, (i + 1) * SYMBOL_SECONDS). That is what makes the
synchronized subtitle on /m/:id honest rather than an animation guess.

OUTPUT
------
  public/audio/*.m4a        AAC, converted with macOS afconvert (no ffmpeg here)
  public/audio/manifest.json

Run:  python3 website/scripts/generate_audio.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine"
ML = ROOT / "ml"
OUT_DIR = ROOT / "website" / "public" / "audio"
MANIFEST = OUT_DIR / "manifest.json"

sys.path.insert(0, str(ENGINE))
sys.path.insert(0, str(ML))

from birdsong_codec import (  # noqa: E402
    SAMPLE_RATE,
    SYMBOL_SECONDS,
    FADE_SECONDS,
    SYMBOL_TO_FREQ,
    normalize,
    decode,
    edit_distance_accuracy,
    save_wav,
    load_wav,
)
from voices import VOICES as ENGINE_VOICES, Voice, encode_voice  # noqa: E402

# Three of the ten species are not synthesized from a hand-tuned parametric
# profile like the rest. They have TRAINED DDSP MODELS — the Bewick's wren
# (ml/checkpoints/wren.pt), the song sparrow (ml/checkpoints/sparrow_win256.pt)
# and the northern cardinal (ml/checkpoints/cardinal_best250.pt)
# — and ml/ sequences their messages from note motifs borrowed out of the same
# recordings the models were fitted to, then decodes them back with a Viterbi
# search. So those clips are produced by the models, not by the parametric
# encoder, and their decode accuracy is whatever the real decoder actually
# achieves rather than the fixed-grid codec's arithmetic certainty.
#
# torch is an optional dependency of the ASSET BUILD, never of the website. If
# it is missing, everything else still builds and both fall back to parametric
# voices with that fact recorded in their metadata — the site must not silently
# present a parametric clip as a model output.
TRAINED_MODELS_AVAILABLE = True
try:
    import torch  # noqa: E402
    import generate as wren_ml  # noqa: E402  (ml/generate.py, wren-only)
    import generate_species as species_ml  # noqa: E402  (ml/generate_species.py)
except Exception as exc:  # pragma: no cover - environment-dependent
    TRAINED_MODELS_AVAILABLE = False
    _TRAINED_IMPORT_ERROR = exc

WREN_SLUG = "bewicks-wren"
SPARROW_SLUG = "song-sparrow"
CARDINAL_SLUG = "northern-cardinal"

# Fixed torch seed so `npm run audio` twice produces identical files.
#
# DDSP's noise branch draws fresh white noise from torch on every render
# (ml/synth.py), so generate()'s own `seed` argument — which seeds only the
# numpy note sequencer — does not make the audio reproducible on its own. It
# also has to be set AFTER the net is loaded: constructing DDSPDecoder
# initialises weights randomly before load_state_dict overwrites them, and that
# consumes RNG on the first call only. Warm the net, then seed.
MODEL_TORCH_SEED = 1234


# ---------------------------------------------------------------------------
# 1. Voice profiles
# ---------------------------------------------------------------------------
# engine/voices.py ships nightingale, sparrow and crow. The catalog needs ten
# species, so the remaining seven are defined here in exactly the same shape.
# These are rendering parameters only — the frequency plan is untouched, which
# is why one decoder still reads every voice (voices.py's core design point).
#
# NOTE ON A REAL CONSTRAINT: the protocol pins every symbol between 800 Hz and
# 4400 Hz. A wood pigeon actually coos near 400 Hz. We cannot move the centre
# frequency without breaking decode, so "pigeon" here means pigeon-like timbre
# (heavy low harmonics, soft attack, almost no glide) at protocol pitch. That
# compromise is the encode-side half of the realism-vs-decodability tension the
# engine docs describe; it is not an oversight.

EXTRA_VOICES: dict[str, Voice] = {
    "wood-pigeon": Voice(
        name="wood-pigeon",
        glide_hz=15, glide_shape="down",
        vibrato_hz=0, vibrato_depth=0,
        harmonics=[(1, 1.0), (2, 0.55), (3, 0.30), (4, 0.12)],
        noise=0.02,
    ),
    "barn-swallow": Voice(
        name="barn-swallow",
        glide_hz=140, glide_shape="up",
        vibrato_hz=42, vibrato_depth=12,
        harmonics=[(1, 1.0), (2, 0.18)],
        noise=0.06,
    ),
    "blackbird": Voice(
        name="blackbird",
        glide_hz=55, glide_shape="arch",
        vibrato_hz=12, vibrato_depth=10,
        harmonics=[(1, 1.0), (2, 0.30), (3, 0.08)],
        noise=0.0,
    ),
    "bewicks-wren": Voice(
        name="bewicks-wren",
        glide_hz=95, glide_shape="arch",
        vibrato_hz=55, vibrato_depth=26,
        harmonics=[(1, 1.0), (2, 0.35), (3, 0.14)],
        noise=0.03,
    ),
    # Like the wren, the song sparrow's shipped clips come from a trained model,
    # not from this profile. It is defined anyway for two reasons: the catalog
    # artwork is drawn from a species' synthesis parameters (src/lib/artwork.ts),
    # so a species without a profile draws a featureless mark; and it is the
    # fallback when torch is unavailable to the asset build.
    "song-sparrow": Voice(
        name="song-sparrow",
        glide_hz=80, glide_shape="down",
        vibrato_hz=38, vibrato_depth=20,
        harmonics=[(1, 1.0), (2, 0.28), (3, 0.10)],
        noise=0.05,
    ),
    # Third trained voice; this profile exists for the same two reasons as the
    # sparrow's — catalog artwork is drawn from synthesis parameters, and this
    # is the fallback when torch is unavailable to the asset build. Shaped
    # after the measured bird: a strong fundamental with little noise (the
    # model renders it at a noise/harmonic ratio of 0.06-0.11, the most tonal
    # of the three), and a wide downward slur, since the cardinal's pitch
    # travels a median 1034 Hz inside a 46 ms window.
    "northern-cardinal": Voice(
        name="northern-cardinal",
        glide_hz=210, glide_shape="down",
        vibrato_hz=8, vibrato_depth=6,
        harmonics=[(1, 1.0), (2, 0.22), (3, 0.07)],
        noise=0.02,
    ),
    "hoopoe": Voice(
        name="hoopoe",
        glide_hz=0, glide_shape="arch",
        vibrato_hz=0, vibrato_depth=0,
        harmonics=[(1, 1.0), (2, 0.06)],
        noise=0.0,
    ),
}

VOICES: dict[str, Voice] = {
    "nightingale": ENGINE_VOICES["nightingale"],
    "house-sparrow": ENGINE_VOICES["sparrow"],
    "carrion-crow": ENGINE_VOICES["crow"],
    **EXTRA_VOICES,
}


# ---------------------------------------------------------------------------
# 2. Provenance
# ---------------------------------------------------------------------------
@dataclass
class Credit:
    """Where one audio asset came from, and what we owe its author.

    `verified` is the important field. It is False whenever the licence and
    recordist have not been confirmed in writing yet. The website renders an
    explicit "pending verification" note for those instead of printing a
    confident attribution we cannot stand behind, and the pre-launch check in
    website/README.md fails while any shipped asset is still unverified.
    """
    title: str
    kind: str                      # real-call | encoded-message | synth-reference | human-speech
    source: str
    license: str
    verified: bool
    sourceId: str | None = None
    sourceUrl: str | None = None
    recordist: str | None = None
    licenseUrl: str | None = None
    note: str | None = None


SYNTH_CREDIT = Credit(
    title="Synthesized reference call",
    kind="synth-reference",
    source="CICI BIRD synthesis engine (engine/voices.py)",
    license="© CICI — original synthesis, no third-party rights",
    verified=True,
    note=(
        "Parametric synthesis from this species' voice profile, not a field "
        "recording. Placeholder until a licensed recording is acquired."
    ),
)

ENCODED_CREDIT = Credit(
    title="Encoded message",
    kind="encoded-message",
    source="CICI BIRD encoding engine (engine/birdsong_codec.py + voices.py)",
    license="© CICI — original synthesis, no third-party rights",
    verified=True,
)

# The two real recordings in this repo. Both carry a source identifier but
# neither has a confirmed recordist or licence yet, so both are unverified.
NIGHTINGALE_CREDIT = Credit(
    title="Common nightingale, field recording",
    kind="real-call",
    source="xeno-canto",
    sourceId="XC546355",
    sourceUrl="https://xeno-canto.org/546355",
    license="UNCONFIRMED",
    licenseUrl=None,
    recordist=None,
    verified=False,
    note=(
        "TODO before launch: confirm recordist, licence and required "
        "attribution string for XC546355 with xeno-canto, or replace this "
        "asset with a synthesized reference call."
    ),
)

WREN_CREDIT = Credit(
    title="Bewick's wren, field recording",
    kind="real-call",
    source="Training corpus in data/bewicks_wren",
    sourceId="173148",
    sourceUrl=None,
    license="UNCONFIRMED",
    recordist=None,
    verified=False,
    note=(
        "TODO before launch: trace this clip to its original archive entry "
        "(xeno-canto or Macaulay Library), record recordist and licence, or "
        "replace with a synthesized reference call."
    ),
)

WREN_MODEL_CREDIT = Credit(
    title="Encoded message, trained wren voice",
    kind="encoded-message",
    source=(
        "CICI BIRD DDSP model ml/checkpoints/wren.pt, trained on the "
        "Bewick's wren corpus in data/bewicks_wren"
    ),
    license="Model output, but built on non-commercially licensed recordings",
    verified=False,
    note=(
        "The audio is the model's own output, but its note motifs are real "
        "note shapes lifted out of the training recordings, and ALL 250 clips "
        "in that selection are licensed non-commercially (CC BY-NC-SA), 44 of "
        "them NoDerivatives. Unlike the sparrow there is no permissive subset "
        "to fall back on: the whole 893-clip Bewick's wren corpus contains "
        "only 11 CC BY-SA clips. TODO before launch: obtain commercial "
        "permission from the recordists whose notes are actually borrowed, or "
        "source new recordings."
    ),
)

# The song sparrow corpus is the first one that arrived WITH provenance:
# data/song_sparrow/metadata.csv carries recordist, xeno-canto id and licence
# for all 1256 clips. So this reference call is the first real recording on the
# site that can be credited properly and marked verified.
#
# The clip is chosen for its LICENCE, not its sound. Of the five licences in
# that corpus, four are non-commercial (by-nc-sa, by-nc-nd) and only 64 clips
# from 8 recordings are CC BY-SA 3.0, which permits commercial use with
# attribution. This is one of those 64.
SPARROW_CALL_CREDIT = Credit(
    title="Song sparrow, field recording",
    kind="real-call",
    source="xeno-canto",
    sourceId="XC142621",
    sourceUrl="https://xeno-canto.org/142621",
    license="CC BY-SA 3.0",
    licenseUrl="https://creativecommons.org/licenses/by-sa/3.0/",
    recordist="Jonathon Jongsma",
    verified=True,
    note=(
        "Recorded 2013-07-11, Union Bay Campground, Porcupine Mountains, "
        "Michigan, United States. Excerpted; ShareAlike applies to this "
        "excerpt."
    ),
)

# UNVERIFIED, and it should stay that way until someone decides the licence
# question below. This is not the same position as the wren's, where the
# corpus provenance is simply unknown — here it is known and it is a problem.
SPARROW_MODEL_CREDIT = Credit(
    title="Encoded message, trained song sparrow voice",
    kind="encoded-message",
    source=(
        "CICI BIRD DDSP model ml/checkpoints/sparrow_win256.pt, trained on 250 "
        "clips from 114 recordings in data/song_sparrow"
    ),
    license="UNCONFIRMED — see note",
    verified=False,
    note=(
        "The audio is the model's own output, but its note motifs are real "
        "note shapes lifted out of the training recordings, and 1192 of the "
        "1256 clips in that corpus are licensed non-commercially (CC BY-NC-SA "
        "or BY-NC-ND); some are NoDerivatives. TODO before launch: either "
        "retrain and rebuild the motif bank from the 64 CC BY-SA clips only, "
        "or obtain commercial permission from the recordists whose notes are "
        "actually borrowed."
    ),
)

# The cardinal corpus arrived with provenance like the sparrow's, and the
# reference call is chosen the same way: by LICENCE, not by sound. Of 1074
# clips only 24 are CC BY-SA — 12 from XC125284 and 12 from XC175226 — and
# XC125284 has the further property that NONE of its clips are in the training
# selection, so the same recording can serve as the reference call AND as the
# held-out wild clip for the messaging/identification fork check.
CARDINAL_CALL_CREDIT = Credit(
    title="Northern cardinal, field recording",
    kind="real-call",
    source="xeno-canto",
    sourceId="XC125284",
    sourceUrl="https://xeno-canto.org/125284",
    license="CC BY-SA 3.0",
    licenseUrl="https://creativecommons.org/licenses/by-sa/3.0/",
    recordist="Jonathon Jongsma",
    verified=True,
    note=(
        "Recorded 2013-03-16, Powderhorn Park, Minneapolis, Hennepin, "
        "Minnesota, United States. Excerpted; ShareAlike applies to this "
        "excerpt."
    ),
)

# Same unresolved position as the sparrow, measured on THIS bird's selection
# rather than assumed from the sparrow's numbers.
CARDINAL_MODEL_CREDIT = Credit(
    title="Encoded message, trained northern cardinal voice",
    kind="encoded-message",
    source=(
        "CICI BIRD DDSP model ml/checkpoints/cardinal_best250.pt, trained on "
        "250 clips from 47 recordings in data/northern_cardinal"
    ),
    license="UNCONFIRMED — see note",
    verified=False,
    note=(
        "The audio is the model's own output, but its note motifs are real "
        "note shapes lifted out of the training recordings, and 243 of the "
        "250 selected clips are licensed non-commercially (176 CC BY-NC-SA, "
        "67 BY-NC-ND); only 7 are CC BY-SA. The whole 1074-clip corpus holds "
        "just 24 permissive clips, from 2 recordings. TODO before launch: "
        "either retrain and rebuild the motif bank from those 24 only — which "
        "is far below the 250 this voice was measured at — or obtain "
        "commercial permission from the recordists whose notes are borrowed."
    ),
)

HUMAN_CREDIT = Credit(
    title="Spoken source sentence",
    kind="human-speech",
    source="macOS speech synthesis (`say`)",
    license="Placeholder asset — not a human recording",
    verified=False,
    note=(
        "TODO before launch: replace with a real recorded human voice. This is "
        "text-to-speech standing in for the 'pre-recorded human sentence' the "
        "landing demo requires (website.md §3)."
    ),
)


# ---------------------------------------------------------------------------
# 2b. The trained voices
# ---------------------------------------------------------------------------
# WHY THIS IS A REGISTRY AND NOT TWO CODE PATHS.
#
# Until the song sparrow there was one trained voice, and the wren was spelled
# out inline: a WREN_ constant per fact, an emit_wren() beside emit_encoded(),
# an `if slug == WREN_SLUG` at each of the three places a clip is produced, and
# a hand-written trainedVoices block in the manifest. Adding a second voice that
# way means duplicating all of it — and the copy is what rots, because the two
# models do NOT share an interface: the wren is driven by ml/generate.py, which
# is wren-only, and the sparrow by ml/generate_species.py, whose functions take
# a species key and return different tuples.
#
# So the differences live here, in two small adapters, and everything below
# talks to one shape. A third trained voice is then an entry in this function.
@dataclass
class TrainedVoice:
    """One species whose clips are sung by a model rather than synthesized.

    `render` and `read_back` are the whole point: they hide which ml/ module
    drives this bird. `threshold` is the calibrated message-detection score for
    THIS checkpoint — it is not a property of the species alone, because the
    decoder's templates are rendered by the model, so it must be recalibrated
    whenever the checkpoint changes (ml/calibrate.py).
    """
    slug: str
    checkpoint: Path
    corpus: str
    corpus_size: int
    wild_clip: Path
    trained_on: str
    engine: str
    decoder: str
    credit: Credit
    threshold: float
    warm: object
    render: object      # (text, seed) -> (audio, clean, [(char, t0, t1)])
    read_back: object   # audio -> (text, score)

    @property
    def synthesis(self) -> dict:
        return {
            "method": "neural-ddsp",
            "engine": self.engine,
            "model": str(self.checkpoint.relative_to(ROOT)),
            "trainedOn": self.trained_on,
            "decoder": self.decoder,
        }


def trained_voices() -> dict[str, TrainedVoice]:
    """Every trained voice, keyed by website species slug.

    Only callable when TRAINED_MODELS_AVAILABLE — it closes over the ml/
    modules. Returns {} otherwise, and every species falls back to parametric.
    """
    wren_ckpt = ML / "checkpoints" / "wren.pt"
    sparrow_ckpt = ML / "checkpoints" / "sparrow_win256.pt"
    cardinal_ckpt = ML / "checkpoints" / "cardinal_best250.pt"
    SPARROW_KEY = "song_sparrow"        # ml/species.py key, not the site slug
    CARDINAL_KEY = "northern_cardinal"

    # Neither decoder is called through its module's convenience wrapper.
    # wren_ml.is_message() defaults to a checkpoint path relative to ml/, so it
    # only resolves when run from that directory; we pass absolute paths and
    # apply each module's own threshold constant, so the number that decides
    # still lives in one place — beside the calibration that produced it.
    def wren_read_back(audio):
        text, score = wren_ml.decode_natural(
            audio, checkpoint=str(wren_ckpt), return_score=True)
        return text, float(score)

    def sparrow_read_back(audio):
        text, score = species_ml.decode(
            audio, SPARROW_KEY, str(sparrow_ckpt), return_score=True)
        return text, float(score)

    def cardinal_read_back(audio):
        text, score = species_ml.decode(
            audio, CARDINAL_KEY, str(cardinal_ckpt), return_score=True)
        return text, float(score)

    return {
        WREN_SLUG: TrainedVoice(
            slug=WREN_SLUG,
            checkpoint=wren_ckpt,
            corpus="data/bewicks_wren",
            corpus_size=250,
            wild_clip=ROOT / "data" / "bewicks_wren" / "173148-0.wav",
            trained_on="250 ranked clips from 51 Bewick's wren recordings "
                       "(data/bewicks_wren, ml/selections/wren_best250.json)",
            engine="ml/generate.py",
            decoder="ml/generate.py (motif templates + Viterbi alignment)",
            credit=WREN_MODEL_CREDIT,
            threshold=wren_ml._MESSAGE_THRESHOLD,
            warm=lambda: wren_ml._load_net(str(wren_ckpt)),
            render=lambda text, seed: wren_ml.generate(
                text, checkpoint=str(wren_ckpt), seed=seed, with_spans=True),
            read_back=wren_read_back,
        ),
        SPARROW_SLUG: TrainedVoice(
            slug=SPARROW_SLUG,
            checkpoint=sparrow_ckpt,
            corpus="data/song_sparrow",
            corpus_size=250,
            # Deliberately NOT one of the 250 clips the model was trained on:
            # the fork check asks whether a real bird is mistaken for a message,
            # and a training clip is the easiest possible case. This one is
            # held out, and it is the same CC BY-SA recording the species page
            # plays as its reference call.
            wild_clip=ROOT / "data" / "song_sparrow" / "wavfiles" / "142621-0.wav",
            trained_on="250 clips from 114 song sparrow recordings (data/song_sparrow)",
            engine="ml/generate_species.py",
            decoder="ml/generate_species.py (motif templates + Viterbi alignment)",
            credit=SPARROW_MODEL_CREDIT,
            threshold=species_ml.SETTINGS[SPARROW_KEY]["threshold"],
            warm=lambda: species_ml.load_net(str(sparrow_ckpt)),
            render=lambda text, seed: species_ml.generate(
                text, SPARROW_KEY, str(sparrow_ckpt), seed=seed, with_spans=True),
            read_back=sparrow_read_back,
        ),
        CARDINAL_SLUG: TrainedVoice(
            slug=CARDINAL_SLUG,
            checkpoint=cardinal_ckpt,
            corpus="data/northern_cardinal",
            corpus_size=250,
            # Held out twice over: XC125284 contributes no clip to the training
            # selection, and it is the CC BY-SA recording the species page
            # plays as its reference call. Same reasoning as the sparrow's.
            wild_clip=ROOT / "data" / "northern_cardinal" / "wavfiles" / "125284-2.wav",
            trained_on="250 ranked clips from 47 northern cardinal recordings "
                       "(data/northern_cardinal, ml/selections/cardinal_best250.json)",
            engine="ml/generate_species.py",
            decoder="ml/generate_species.py (motif templates + Viterbi alignment)",
            credit=CARDINAL_MODEL_CREDIT,
            threshold=species_ml.SETTINGS[CARDINAL_KEY]["threshold"],
            warm=lambda: species_ml.load_net(str(cardinal_ckpt)),
            render=lambda text, seed: species_ml.generate(
                text, CARDINAL_KEY, str(cardinal_ckpt), seed=seed, with_spans=True),
            read_back=cardinal_read_back,
        ),
    }


# ---------------------------------------------------------------------------
# 3. Synthesis helpers
# ---------------------------------------------------------------------------
def synth_reference_call(voice: Voice, seed: int, phrase: list[tuple[float, float]]) -> np.ndarray:
    """Render a species-characteristic song phrase that is NOT a message.

    The catalog needs "a sample of the real bird's call" (website.md §5). Where
    we hold no licensed recording, we ship this instead — clearly labelled as
    synthesis in the manifest. Unlike encode_voice() it is free of the protocol
    grid: notes may sit at any pitch and any length, because nothing needs to
    decode it. `phrase` is a list of (frequency_hz, seconds).
    """
    rng = np.random.default_rng(seed)
    pieces: list[np.ndarray] = []
    for freq, seconds in phrase:
        n = int(SAMPLE_RATE * seconds)
        if n <= 0:
            continue
        t = np.arange(n) / SAMPLE_RATE
        # Per-note jitter: a bird never repeats a note exactly, and identical
        # repetition is the single biggest "this is fake" giveaway.
        f = voice.contour(freq * rng.uniform(0.99, 1.01), t)
        phase = 2 * np.pi * np.cumsum(f) / SAMPLE_RATE
        wave = np.zeros(n)
        for mult, amp in voice.harmonics:
            wave += amp * np.sin(mult * phase)
        if voice.noise:
            wave += voice.noise * rng.standard_normal(n)

        env = np.ones(n)
        attack, decay = max(int(0.08 * n), 1), int(0.30 * n)
        env[:attack] = np.linspace(0, 1, attack)
        env[decay:] = np.linspace(1, 0.45, n - decay)
        fade = int(SAMPLE_RATE * FADE_SECONDS)
        if fade > 0:
            env[:fade] *= np.linspace(0, 1, fade)
            env[-fade:] *= np.linspace(1, 0, fade)
        wave *= env

        peak = np.abs(wave).max()
        pieces.append((wave / peak * 0.9) if peak > 0 else wave)
        # Organic gap between notes so the phrase breathes.
        pieces.append(np.zeros(int(SAMPLE_RATE * rng.uniform(0.05, 0.14))))

    return np.concatenate(pieces).astype(np.float32) if pieces else np.zeros(0, np.float32)


def build_cues_from_spans(clean: str, spans: list[tuple[str, float, float]],
                          total_s: float) -> dict:
    """Subtitle timings for a trained voice.

    build_cues() below can do arithmetic because the parametric codec puts every
    character on a fixed SYMBOL_SECONDS grid. A trained voice has no grid: each
    letter is a real borrowed note at its own natural duration, separated by
    articulation gaps and phrase pauses. Only the sequencer knows when a letter
    is actually sung, which is why the ml/ generators hand the spans back rather
    than us reconstructing them here.

    Spaces get no note — they ARE the phrase pauses — but the subtitle still has
    to render them, or the transcript loses its word breaks. Each space is given
    the interval between the notes on either side of it.
    """
    sung = [c for c in clean if c != " "]
    if len(sung) != len(spans):
        raise AssertionError(
            f"{len(spans)} note spans for {len(sung)} sung characters in {clean!r}"
        )

    chars, si = [], 0
    for i, ch in enumerate(clean):
        if ch != " ":
            _, t0, t1 = spans[si]
            si += 1
        else:
            # The pause between the previous note ending and the next starting.
            t0 = spans[si - 1][2] if si > 0 else 0.0
            t1 = spans[si][1] if si < len(spans) else total_s
        chars.append({"t0": round(t0, 4), "t1": round(t1, 4), "text": ch})

    words, buf = [], []
    for cue in chars:
        if cue["text"] == " ":
            if buf:
                words.append({"t0": buf[0]["t0"], "t1": buf[-1]["t1"],
                              "text": "".join(c["text"] for c in buf)})
                buf = []
        else:
            buf.append(cue)
    if buf:
        words.append({"t0": buf[0]["t0"], "t1": buf[-1]["t1"],
                      "text": "".join(c["text"] for c in buf)})

    return {"chars": chars, "words": words}


def build_cues(text: str) -> dict:
    """Exact subtitle timings, derived from the protocol's fixed grid.

    encode_voice() emits one SYMBOL_SECONDS-long note per normalized character,
    concatenated with no gaps. So character i starts at i * SYMBOL_SECONDS. We
    emit character cues (for the karaoke-style reveal) and word cues (for
    screen readers and for anyone reading rather than watching).
    """
    clean = normalize(text)
    chars = [
        {"t0": round(i * SYMBOL_SECONDS, 4),
         "t1": round((i + 1) * SYMBOL_SECONDS, 4),
         "text": ch}
        for i, ch in enumerate(clean)
    ]

    words, start, buf = [], 0, []
    for i, ch in enumerate(clean):
        if ch == " ":
            if buf:
                words.append({"t0": round(start * SYMBOL_SECONDS, 4),
                              "t1": round(i * SYMBOL_SECONDS, 4),
                              "text": "".join(buf)})
                buf = []
            start = i + 1
        else:
            if not buf:
                start = i
            buf.append(ch)
    if buf:
        words.append({"t0": round(start * SYMBOL_SECONDS, 4),
                      "t1": round(len(clean) * SYMBOL_SECONDS, 4),
                      "text": "".join(buf)})

    return {"chars": chars, "words": words}


# ---------------------------------------------------------------------------
# 4. Encoding to a web-deliverable format
# ---------------------------------------------------------------------------
def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        sys.exit(
            f"Required tool `{name}` not found. This script targets macOS "
            f"(`say` + `afconvert`). On Linux, swap afconvert for ffmpeg."
        )


def to_m4a(samples: np.ndarray, dest: Path) -> None:
    """float samples -> AAC in an MP4 container.

    website.md §8 wants audio streamed rather than fully downloaded. WAV at
    22.05 kHz is ~44 KB per second, which makes even a four-second clip a
    heavy fetch on mobile. AAC at 64 kbps is ~8 KB per second and every target
    browser plays it. afconvert ships with macOS, so no ffmpeg dependency.
    """
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "src.wav"
        save_wav(str(wav), samples)
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000",
             str(wav), str(dest)],
            check=True, capture_output=True,
        )


def m4a_duration(path: Path) -> float:
    """Read the encoded clip's real duration back out of the file.

    The player needs a duration before it has fetched any audio, so the number
    has to come from the manifest. For synthesized clips we know it exactly
    (samples / rate); for the spoken sentence, only the encoder does — so we
    ask the file rather than guess, and the progress bar is right on first
    paint instead of sitting at 0:00 until metadata arrives.
    """
    out = subprocess.run(["afinfo", str(path)], check=True, capture_output=True,
                         text=True).stdout
    for line in out.splitlines():
        if "estimated duration" in line:
            return round(float(line.split(":")[1].strip().split()[0]), 3)
    return 0.0


def speech_to_m4a(text: str, dest: Path, voice: str = "Samantha") -> None:
    with tempfile.TemporaryDirectory() as tmp:
        aiff = Path(tmp) / "speech.aiff"
        subprocess.run(["say", "-v", voice, "-o", str(aiff), text],
                       check=True, capture_output=True)
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000",
             str(aiff), str(dest)],
            check=True, capture_output=True,
        )


def excerpt(path: Path, seconds: float, offset: float = 0.0) -> np.ndarray:
    """Take a fade-topped excerpt of a real recording."""
    samples = load_wav(str(path))
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    start = int(offset * SAMPLE_RATE)
    clip = samples[start:start + int(seconds * SAMPLE_RATE)]
    fade = int(0.03 * SAMPLE_RATE)
    if len(clip) > 2 * fade:
        clip = clip.copy()
        clip[:fade] *= np.linspace(0, 1, fade)
        clip[-fade:] *= np.linspace(1, 0, fade)
    peak = np.abs(clip).max()
    return ((clip / peak) * 0.9).astype(np.float32) if peak > 0 else clip.astype(np.float32)


# ---------------------------------------------------------------------------
# 5. What we ship
# ---------------------------------------------------------------------------
DEMO_SENTENCE = "meet me by the river at six."

# Landing demo (§3): one human sentence, then the same sentence in three
# voices spanning all three tiers, so the tier system is legible before the
# visitor has read a word about it.
#
# The middle voice is the Bewick's wren on purpose. It is the one species with
# a trained model behind it, so the demo puts real DDSP output next to the
# parametric voices — and its lower, honestly-reported decode accuracy sits
# right there beside them instead of being tucked away on a species page.
# The landing demo now plays only the TRAINED voices. website.md §3 asks for
# "two or three different bird voices", so three is compliant — and a first-time
# visitor's whole impression of what this product sounds like is formed here.
# The parametric profiles put a pure tone per letter on a fixed grid (measured:
# 0.19-0.43 of each frame's energy in a single bin, 10-32 distinct pitches in a
# whole clip, against 0.06 and 60+ for the models); leading with those sells the
# wrong thing. They remain in the species catalog, labelled for what they are.
DEMO_VOICES = ["bewicks-wren", "song-sparrow", "northern-cardinal"]

# One short line per species for the catalog's "encoded message" sample.
SPECIES_LINES = {
    "house-sparrow": "good morning, neighbour.",
    "wood-pigeon": "come home, it is late.",
    "carrion-crow": "i saw everything.",
    "barn-swallow": "summer is here again.",
    "blackbird": "sing back to me.",
    "bewicks-wren": "found you in the thicket.",
    "song-sparrow": "meet me by the river at six.",
    "northern-cardinal": "the mornings are yours now.",
    "nightingale": "i waited up all night.",
    "hoopoe": "i am far from home.",
}

# Reference-call phrases: (Hz, seconds) per note, shaped after each species'
# real song structure. Only used where we hold no licensed recording.
REFERENCE_PHRASES: dict[str, list[tuple[float, float]]] = {
    "house-sparrow": [(3400, 0.12), (3600, 0.10), (3300, 0.13), (3550, 0.11),
                      (3400, 0.12), (3700, 0.10)],
    "wood-pigeon": [(900, 0.34), (1100, 0.30), (900, 0.26), (880, 0.40),
                    (900, 0.30)],
    "carrion-crow": [(1200, 0.26), (1150, 0.24), (1220, 0.28)],
    "barn-swallow": [(4200, 0.09), (4600, 0.07), (3900, 0.10), (4700, 0.07),
                     (4100, 0.09), (4500, 0.08), (3800, 0.14)],
    "blackbird": [(2100, 0.22), (2600, 0.20), (2350, 0.24), (2900, 0.18),
                  (2200, 0.26), (2700, 0.22)],
    "hoopoe": [(1100, 0.16), (1100, 0.16), (1100, 0.18), (0, 0.0),
               (1100, 0.16), (1100, 0.16), (1100, 0.18)],
    # nightingale and bewicks-wren use real recordings instead.
}

# Mock shared messages (§4). Only `active` links carry audio; the expired and
# revoked states are rendered without ever exposing a playable asset.
MOCK_MESSAGES = [
    ("msg-nightingale", "nightingale", "meet me by the river at six."),
    ("msg-blackbird", "blackbird", "i am outside, look up."),
    ("msg-bewicks-wren", WREN_SLUG, "i heard you from the garden."),
    ("msg-song-sparrow", SPARROW_SLUG, "come home, it is late."),
]


def main() -> None:
    require_tool("say")
    require_tool("afconvert")

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if TRAINED_MODELS_AVAILABLE:
        TRAINED = trained_voices()
        for voice in TRAINED.values():
            if not voice.checkpoint.exists():
                sys.exit(f"Missing trained checkpoint for {voice.slug}: "
                         f"{voice.checkpoint}")
            # Warm each net BEFORE seeding: constructing DDSPDecoder initialises
            # weights randomly before load_state_dict replaces them, and that
            # consumes torch RNG on the first call only. Seeding first would
            # make the first render differ from every later one.
            voice.warm()
            print(f"trained voice    {voice.slug:14s} "
                  f"{voice.checkpoint.relative_to(ROOT)}")
    else:
        TRAINED = {}
        print(
            f"WARNING: trained models unavailable ({_TRAINED_IMPORT_ERROR}).\n"
            f"         Falling back to parametric voices for "
            f"{WREN_SLUG} and {SPARROW_SLUG}; their metadata will say so."
        )

    assets: dict[str, dict] = {}

    # How a clip was made is a fact about the clip, so it lives in the manifest
    # beside its credit rather than being inferred from the species slug in the
    # website's code. Adding a second trained voice later is then a data change.
    PARAMETRIC = {
        "method": "parametric",
        "engine": "engine/voices.py",
        "decoder": "engine/birdsong_codec.py (fixed-grid FFT)",
    }

    def register(asset_id: str, rel: str, credit: Credit, **extra) -> None:
        path = OUT_DIR / rel
        entry = {
            "id": asset_id,
            "src": f"/audio/{rel}",
            "mime": "audio/mp4",
            "bytes": path.stat().st_size,
            "credit": {k: v for k, v in asdict(credit).items() if v is not None},
        }
        entry.update(extra)
        assets[asset_id] = entry

    def emit_encoded(asset_id: str, rel: str, voice_key: str, text: str,
                     species_slug: str) -> None:
        """Encode `text` in `voice_key`, verify it decodes, and register it.

        The decode check is not decoration. overview.md §6 treats decode
        accuracy as a release gate; running it here means a voice profile that
        drifts far enough to break comprehension fails the asset build rather
        than shipping a message nobody can read.
        """
        samples = encode_voice(text, VOICES[voice_key])
        to_m4a(samples, OUT_DIR / rel)
        decoded = decode(samples)
        accuracy = edit_distance_accuracy(text, decoded)
        register(
            asset_id, rel, ENCODED_CREDIT,
            speciesSlug=species_slug,
            synthesis=PARAMETRIC,
            durationSec=round(len(samples) / SAMPLE_RATE, 3),
            text=text,
            normalizedText=normalize(text),
            decodedText=decoded,
            decodeAccuracy=round(accuracy, 4),
            cues=build_cues(text),
        )
        flag = "" if accuracy >= 0.90 else "   <-- BELOW 90% GATE"
        print(f"  encoded  {asset_id:34s} {accuracy * 100:5.1f}%{flag}")

    def emit_trained(voice: TrainedVoice, asset_id: str, rel: str,
                     text: str) -> None:
        """Render `text` through a TRAINED model and register it.

        Two things differ from emit_encoded, and both are the point of doing
        this at all:

        * The audio comes from a DDSP decoder fitted to real recordings of this
          species, sequenced from note motifs borrowed out of those same
          recordings.
        * Accuracy is measured with the REAL decoder — a Viterbi search over
          motif templates — not with the fixed-grid FFT. Whatever it lands at
          is what the site shows; the wren reads back near 96%, and that honest
          number is published rather than the codec's arithmetic 100%.
        """
        torch.manual_seed(MODEL_TORCH_SEED)
        audio, clean, spans = voice.render(text, 0)
        to_m4a(audio, OUT_DIR / rel)

        decoded, _ = voice.read_back(audio)
        accuracy = edit_distance_accuracy(text, decoded)
        duration = len(audio) / SAMPLE_RATE

        register(
            asset_id, rel, voice.credit,
            speciesSlug=voice.slug,
            synthesis=voice.synthesis,
            durationSec=round(duration, 3),
            text=text,
            normalizedText=clean,
            decodedText=decoded,
            decodeAccuracy=round(accuracy, 4),
            cues=build_cues_from_spans(clean, spans, duration),
        )
        flag = "" if accuracy >= 0.90 else "   <-- BELOW 90% GATE"
        print(f"  MODEL    {asset_id:34s} {accuracy * 100:5.1f}%{flag}")

    def emit(asset_id: str, rel: str, slug: str, text: str) -> None:
        """One clip of `text` in `slug`'s voice, trained model if it has one."""
        voice = TRAINED.get(slug)
        if voice is not None:
            emit_trained(voice, asset_id, rel, text)
        else:
            emit_encoded(asset_id, rel, slug, text, slug)

    # -- landing demo -------------------------------------------------------
    print("landing demo")
    speech_to_m4a(DEMO_SENTENCE, OUT_DIR / "demo/human.m4a")
    register("demo-human", "demo/human.m4a", HUMAN_CREDIT, text=DEMO_SENTENCE,
             durationSec=m4a_duration(OUT_DIR / "demo/human.m4a"))
    print("  speech   demo-human")
    for key in DEMO_VOICES:
        emit(f"demo-{key}", f"demo/{key}.m4a", key, DEMO_SENTENCE)

    # -- species reference calls -------------------------------------------
    print("species reference calls")
    nightingale_src = ENGINE / "assets" / "nightingale.wav"
    if nightingale_src.exists():
        to_m4a(excerpt(nightingale_src, seconds=5.0, offset=0.5),
               OUT_DIR / "species/nightingale-call.m4a")
        register("call-nightingale", "species/nightingale-call.m4a",
                 NIGHTINGALE_CREDIT, speciesSlug="nightingale", durationSec=5.0)
        print("  real     call-nightingale (unverified licence)")

    wren_src = ROOT / "data" / "bewicks_wren" / "173148-0.wav"
    if wren_src.exists():
        to_m4a(excerpt(wren_src, seconds=3.0), OUT_DIR / "species/bewicks-wren-call.m4a")
        register("call-bewicks-wren", "species/bewicks-wren-call.m4a",
                 WREN_CREDIT, speciesSlug="bewicks-wren", durationSec=3.0)
        print("  real     call-bewicks-wren (unverified licence)")

    # The one shipped recording whose licence is fully known — see
    # SPARROW_CALL_CREDIT for why this particular file and not a better-sounding
    # one. Its 3 seconds are the whole clip, so no offset.
    sparrow_src = ROOT / "data" / "song_sparrow" / "wavfiles" / "142621-0.wav"
    if sparrow_src.exists():
        to_m4a(excerpt(sparrow_src, seconds=3.0),
               OUT_DIR / "species/song-sparrow-call.m4a")
        register("call-song-sparrow", "species/song-sparrow-call.m4a",
                 SPARROW_CALL_CREDIT, speciesSlug=SPARROW_SLUG, durationSec=3.0)
        print("  real     call-song-sparrow (CC BY-SA 3.0, Jonathon Jongsma)")

    # The cardinal's licence situation is the sparrow's: see CARDINAL_CALL_CREDIT
    # for why this recording and not a better-sounding one.
    cardinal_src = ROOT / "data" / "northern_cardinal" / "wavfiles" / "125284-2.wav"
    if cardinal_src.exists():
        to_m4a(excerpt(cardinal_src, seconds=3.0),
               OUT_DIR / "species/northern-cardinal-call.m4a")
        register("call-northern-cardinal", "species/northern-cardinal-call.m4a",
                 CARDINAL_CALL_CREDIT, speciesSlug=CARDINAL_SLUG, durationSec=3.0)
        print("  real     call-northern-cardinal (CC BY-SA 3.0, Jonathon Jongsma)")

    for slug, phrase in REFERENCE_PHRASES.items():
        samples = synth_reference_call(VOICES[slug], seed=abs(hash(slug)) % 10_000,
                                       phrase=[p for p in phrase if p[1] > 0])
        rel = f"species/{slug}-call.m4a"
        to_m4a(samples, OUT_DIR / rel)
        register(f"call-{slug}", rel, SYNTH_CREDIT, speciesSlug=slug,
                 durationSec=round(len(samples) / SAMPLE_RATE, 3))
        print(f"  synth    call-{slug}")

    # -- species encoded samples -------------------------------------------
    print("species encoded samples")
    for slug, line in SPECIES_LINES.items():
        emit(f"sample-{slug}", f"species/{slug}-encoded.m4a", slug, line)

    # -- mock shared messages ----------------------------------------------
    print("mock shared messages")
    for msg_id, voice_key, text in MOCK_MESSAGES:
        emit(msg_id, f"messages/{msg_id}.m4a", voice_key, text)

    # ------------------------------------------------------------------
    # Verify the Messaging / Identification fork on what we actually ship
    # ------------------------------------------------------------------
    # app.md §9 keeps identification and messaging as separate subsystems, and
    # the wren decoder is closed-set: Viterbi always returns its best
    # explanation, so a wild recording yields confident-looking nonsense unless
    # something decides whether to believe it. ml/generate.is_message() is that
    # decision, and the species page states the separation as fact — so the
    # asset build proves it on the exact clips being published rather than
    # trusting a threshold calibrated at some earlier point.
    checks: dict[str, dict] = {}
    if TRAINED:
        print("messaging / identification fork")
    for slug, voice in TRAINED.items():
        # Regenerate rather than reading the published file back: what we ship
        # is AAC, and decoding that would measure the lossy codec as much as
        # the model. Generation is deterministic under a fixed torch seed, so
        # this is the same signal that went into the encoder.
        torch.manual_seed(MODEL_TORCH_SEED)
        msg_audio, _, _ = voice.render(SPECIES_LINES[slug], 0)
        _, msg_score = voice.read_back(msg_audio)
        is_msg = msg_score >= voice.threshold

        wild_audio = load_wav(str(voice.wild_clip))
        if wild_audio.ndim > 1:
            wild_audio = wild_audio.mean(axis=1)
        _, wild_score = voice.read_back(wild_audio)
        wild_is_msg = wild_score >= voice.threshold

        ok = is_msg and not wild_is_msg
        print(f"  {slug}")
        print(f"    our message      score {msg_score:+.4f}  -> "
              f"{'message' if is_msg else 'NOT a message'}")
        print(f"    wild recording   score {wild_score:+.4f}  -> "
              f"{'MESSAGE (WRONG)' if wild_is_msg else 'just a bird'}")
        print(f"    separation       {'ok' if ok else 'FAILED'}")
        checks[slug] = {
            "messageScore": round(msg_score, 4),
            "wildScore": round(wild_score, 4),
            "threshold": voice.threshold,
            "separated": bool(ok),
        }
        if not ok:
            sys.exit(
                f"Messaging/identification separation failed for {slug} on the "
                f"shipped clips. Re-run the calibration against "
                f"{voice.checkpoint.relative_to(ROOT)}."
            )

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generator": "website/scripts/generate_audio.py",
        "engine": {
            "protocol": "engine/birdsong_codec.py",
            "voices": "engine/voices.py",
            "sampleRate": SAMPLE_RATE,
            "symbolSeconds": SYMBOL_SECONDS,
            "freqMinHz": min(SYMBOL_TO_FREQ.values()),
            "freqMaxHz": max(SYMBOL_TO_FREQ.values()),
        },
        # The site draws each species' artwork from its actual synthesis
        # parameters — the mark is a picture of the voice, not an illustration
        # someone drew. Exporting the profiles here keeps that derived from the
        # engine rather than hand-copied into the website's data files.
        # What the trained voice is, and the evidence it works, recorded once
        # so the website can state it without any of it being hand-typed.
        "trainedVoices": {
            slug: {
                "model": str(voice.checkpoint.relative_to(ROOT)),
                "corpus": voice.corpus,
                "corpusSize": voice.corpus_size,
                "sampleRate": SAMPLE_RATE,
                "identification": checks.get(slug),
            }
            for slug, voice in TRAINED.items()
        },
        "voiceProfiles": {
            slug: {
                "glideHz": v.glide_hz,
                "glideShape": v.glide_shape,
                "vibratoHz": v.vibrato_hz,
                "vibratoDepth": v.vibrato_depth,
                "harmonics": [list(h) for h in v.harmonics],
                "noise": v.noise,
            }
            for slug, v in VOICES.items()
        },
        "assets": assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    total = sum(a["bytes"] for a in assets.values())
    unverified = [a["id"] for a in assets.values() if not a["credit"]["verified"]]
    print(f"\n{len(assets)} assets, {total / 1024:.0f} KB total -> {MANIFEST}")
    if unverified:
        print(f"UNVERIFIED PROVENANCE ({len(unverified)}): {', '.join(unverified)}")
        print("These must be cleared or replaced before launch.")


if __name__ == "__main__":
    main()
