#!/usr/bin/env python3
"""Encode one message in one trained voice.

`encode()` is the whole implementation and the only one: the CLI below wraps it
for the local Next route, which shells out per request, and service/app.py
imports the same function for the hosted deployment. Two call sites, one
renderer — a second copy of this would be a voice that drifts.

It adds no synthesis of its own. Every number comes from code that already
ships the site's pre-rendered audio:

    generate_audio.trained_voices()         the slug -> (render, read_back) map
    generate_audio.build_cues_from_spans()  subtitle timings from real spans
    generate_audio.edit_distance_accuracy() the honest decode accuracy

WAV rather than generate_audio.to_m4a: that shells out to macOS `afconvert`,
and a data: URI of 16-bit PCM is 137 KB for a five-second message, which the
browser plays without a codec detour.

CONCURRENCY IS THE CALLER'S PROBLEM, and it is a real one: ml/generate.py
mutates a module-global _SIG_MEAN inside _template_bank, so two decodes against
different checkpoints in one interpreter are not safe. The CLI gets that for
free with a process per request; the service serializes with a lock.

stdout is reserved for the CLI's JSON. ml/data.py's load_cache prints "features:
cache hit" on the sparrow and cardinal paths, which lands in the middle of the
payload and makes it unparseable — measured, not hypothetical. So the ml/ call
runs with sys.stdout pointed at stderr and only the final dump goes to the real
one. (Under the service that redirect is harmless: nothing reads its stdout.)
"""
import argparse
import base64
import contextlib
import io
import json
import sys

import numpy as np
import soundfile as sf

import generate_audio as ga


class EncodeError(Exception):
    """A bad request — an unknown voice, or no models on this machine."""


def encode(text, voice_slug, seed=0):
    """text -> the payload the player needs. Raises EncodeError on bad input."""
    if not ga.TRAINED_MODELS_AVAILABLE:
        raise EncodeError(f"trained models unavailable: {ga._TRAINED_IMPORT_ERROR}")

    voices = ga.trained_voices()
    if voice_slug not in voices:
        raise EncodeError(
            f"unknown voice {voice_slug!r}; known: {', '.join(sorted(voices))}")
    voice = voices[voice_slug]

    with _quiet_stdout():
        # Warm the net BEFORE seeding: DDSPDecoder.__init__ initialises weights
        # randomly before load_state_dict overwrites them, and that consumes RNG
        # on the first call only. Same order as generate_audio.py:832-838, and
        # without it the same text renders differently run to run.
        voice.warm()
        ga.torch.manual_seed(ga.MODEL_TORCH_SEED)

        audio, clean, spans = voice.render(text, seed)
        duration = len(audio) / ga.SAMPLE_RATE
        decoded, _score = voice.read_back(audio)

    buf = io.BytesIO()
    sf.write(buf, np.clip(audio, -1.0, 1.0), ga.SAMPLE_RATE,
             subtype="PCM_16", format="WAV")

    return {
        "normalizedText": clean,
        "decodedText": decoded,
        "decodeAccuracy": round(ga.edit_distance_accuracy(text, decoded), 4),
        "durationSec": round(duration, 3),
        "cues": ga.build_cues_from_spans(clean, spans, duration),
        "wavBase64": base64.b64encode(buf.getvalue()).decode("ascii"),
    }


@contextlib.contextmanager
def _quiet_stdout():
    """Keep ml/'s progress chatter out of whatever the caller is writing."""
    saved, sys.stdout = sys.stdout, sys.stderr
    try:
        yield
    finally:
        sys.stdout = saved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--voice", required=True, help="site slug, e.g. bewicks-wren")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    try:
        json.dump(encode(a.text, a.voice, a.seed), sys.stdout)
    except EncodeError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stdout)
        sys.exit(1)


if __name__ == "__main__":
    main()
