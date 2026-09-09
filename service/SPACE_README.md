---
title: CICI BIRD encoder
emoji: 🐦
colorFrom: yellow
colorTo: gray
sdk: gradio
sdk_version: "6.26.0"
python_version: "3.12"
app_file: app.py
pinned: false
license: mit
---

# CICI BIRD encoder

Type a sentence and hear it sung by a DDSP model trained on real recordings —
Bewick's wren, song sparrow or northern cardinal — then read back by the same
decoder that has to recover it.

This is not a filter over a voice. Text maps to a 31-symbol alphabet, each
letter is a fixed motif borrowed from a real note of that species, and the
model sings the resulting pitch and loudness contour. The decode accuracy shown
is measured on the clip you just heard, not quoted from a paper.

It also backs the encoder on the CICI BIRD site, as a plain endpoint beside the
demo:

    POST /encode  {"text": "meet me by the river at six.", "voice": "bewicks-wren"}
    GET  /health

Text is capped at 80 characters and folded to `a-z`, space and `.,'?`;
anything else becomes a pause.

The 3.6 GB recording corpus is not deployed here — only the 31 motifs each
voice actually sings, which is 172 KB and renders audio bit-identical to the
full-corpus path.
