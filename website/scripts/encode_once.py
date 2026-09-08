#!/usr/bin/env python3
"""Encode one message in one trained voice, as JSON on stdout.

This is the /api/encode worker. It exists so the Next route can shell out to a
single process and get back everything the player needs; it adds no synthesis
of its own. Every number here comes from code that already ships the site's
pre-rendered audio:

    generate_audio.trained_voices()        the slug -> (render, read_back) map
    generate_audio.build_cues_from_spans() subtitle timings from real spans
    generate_audio.edit_distance_accuracy() the honest decode accuracy

WAV rather than generate_audio.to_m4a: that shells out to macOS `afconvert`,
and a data: URI of 16-bit PCM is 137 KB for a five-second message, which the
browser plays without a codec detour.

One process per request. ml/generate.py mutates a module-global _SIG_MEAN
inside _template_bank, so two decodes against different checkpoints in one
interpreter are not safe; a fresh process makes that impossible by
construction, and the whole cold run measures ~1.6s.

stdout is reserved for the JSON. ml/data.py's load_cache prints "features:
cache hit" on the sparrow and cardinal paths, which lands in the middle of the
payload and makes it unparseable — measured, not hypothetical. So the ml/ call
runs with sys.stdout pointed at stderr and only the final dump goes to the
real one.
"""
import argparse
import base64
import io
import json
import sys

import numpy as np
import soundfile as sf

import generate_audio as ga


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--voice", required=True, help="site slug, e.g. bewicks-wren")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()

    # ml/ chatters on stdout; keep it off the payload. See the module docstring.
    out, sys.stdout = sys.stdout, sys.stderr

    if not ga.TRAINED_MODELS_AVAILABLE:
        fail(f"trained models unavailable: {ga._TRAINED_IMPORT_ERROR}")

    voices = ga.trained_voices()
    if a.voice not in voices:
        fail(f"unknown voice {a.voice!r}; known: {', '.join(sorted(voices))}")
    voice = voices[a.voice]

    # Warm the net BEFORE seeding: DDSPDecoder.__init__ initialises weights
    # randomly before load_state_dict overwrites them, and that consumes RNG on
    # the first call only. Same order as generate_audio.py:832-838, and without
    # it the same text renders differently run to run.
    voice.warm()
    ga.torch.manual_seed(ga.MODEL_TORCH_SEED)

    audio, clean, spans = voice.render(a.text, a.seed)
    duration = len(audio) / ga.SAMPLE_RATE
    decoded, _score = voice.read_back(audio)

    buf = io.BytesIO()
    sf.write(buf, np.clip(audio, -1.0, 1.0), ga.SAMPLE_RATE,
             subtype="PCM_16", format="WAV")

    sys.stdout = out
    json.dump({
        "normalizedText": clean,
        "decodedText": decoded,
        "decodeAccuracy": round(ga.edit_distance_accuracy(a.text, decoded), 4),
        "durationSec": round(duration, 3),
        "cues": ga.build_cues_from_spans(clean, spans, duration),
        "wavBase64": base64.b64encode(buf.getvalue()).decode("ascii"),
    }, sys.stdout)


def fail(msg):
    print(json.dumps({"error": msg}), file=sys.__stdout__)
    sys.exit(1)


if __name__ == "__main__":
    main()
