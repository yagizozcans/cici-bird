---
title: CICI BIRD encoder
emoji: 🐦
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# CICI BIRD encoder

Turns a short sentence into birdsong, sung by one of three DDSP models trained
on real recordings (Bewick's wren, song sparrow, northern cardinal), and reads
it back with the same decoder to report how much of it survived.

This is the backend for the encoder on the CICI BIRD site. It is not a filter
over a voice: text is mapped to a symbol alphabet, each letter is a fixed motif
borrowed from a real note of that species, and the model sings the resulting
pitch and loudness contour.

    POST /encode  {"text": "meet me by the river at six.", "voice": "bewicks-wren"}
    GET  /health

Voices: `bewicks-wren`, `song-sparrow`, `northern-cardinal`. Text is capped at
80 characters and folded to the 31-symbol alphabet (`a-z`, space, `.,'?`);
anything else becomes a pause.

The 3.6 GB recording corpus is not deployed here. Only the 31 motifs each voice
actually sings are, which is 172 KB and renders audio bit-identical to the full
corpus path.
