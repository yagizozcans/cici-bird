"""The hosted encoder: a Gradio Space that is also a plain HTTP endpoint.

Why this exists: encoding needs torch, the checkpoints and a motif library, and
the site deploys `website/` to Vercel alone — where torch is ~200 MB against a
250 MB function limit. So the Next route calls this when ENCODE_SERVICE_URL is
set and shells out to the same `encode_once.encode` locally when it is not.
There is one renderer; only the transport differs.

TWO SURFACES, ONE APP. Gradio is mounted at `/`, so the Space has a face
someone can actually try, and Gradio's own `/config` answers the platform's
health check. `POST /encode` is a FastAPI route beside it, which the site uses
because it is a single request with a plain JSON body — Gradio's REST API is a
two-step call-then-poll, and the site does not need a queue to talk to itself.

The corpus is NOT here. preload.py fills the shape-library caches from
motifs.json first, then makes every route back to the recordings raise, so a
regression is a crash at startup rather than a bird that quietly changed.

ONE ENCODE AT A TIME, deliberately. ml/generate.py mutates a module-global
_SIG_MEAN inside _template_bank, so decoding two checkpoints concurrently in
one interpreter mis-centres one of them. The local CLI avoids this with a
process per request; a long-lived server has to take a lock. Encoding is ~0.5 s
once warm, so the queue is short, and the alternative is a wrong answer rather
than a slow one.
"""
import base64
import os
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.abspath(__file__))
for _sub in ("engine", "ml", os.path.join("website", "scripts")):
    sys.path.insert(0, os.path.join(ROOT, _sub))

import gradio as gr                                      # noqa: E402
import uvicorn                                           # noqa: E402
from fastapi import FastAPI                               # noqa: E402
from fastapi.middleware.cors import CORSMiddleware        # noqa: E402
from fastapi.responses import JSONResponse                # noqa: E402
from pydantic import BaseModel, Field                     # noqa: E402

import preload                                            # noqa: E402

_wren, _gs = preload.preload()
preload.assert_offline(_wren, _gs)

import encode_once                                        # noqa: E402

VOICES = ["bewicks-wren", "song-sparrow", "northern-cardinal"]
MAX_CHARS = 80
PORT = int(os.environ.get("PORT", 7860))

# Only the site may call this from a browser. Set ALLOWED_ORIGIN to the
# deployed origin in the Space's settings. The default is deliberately one
# origin rather than "*", because an open endpoint is a free CPU faucet.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://cici-bird.vercel.app")

_lock = threading.Lock()

api = FastAPI(title="cici bird encoder")
api.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["POST"],
    allow_headers=["content-type"],
)


class EncodeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)
    voice: str
    seed: int = 0


def run(text, voice, seed=0):
    """The one entry point both surfaces use. Serialized; see the docstring."""
    with _lock:
        return encode_once.encode(text[:MAX_CHARS], voice, seed)


@api.get("/health")
def health():
    return {"ok": True, "voices": VOICES}


@api.post("/encode")
def post_encode(request: EncodeRequest):
    if request.voice not in VOICES:
        return JSONResponse({"error": "unknown voice"}, status_code=400)
    if not request.text.strip():
        return JSONResponse({"error": "empty text"}, status_code=400)
    try:
        return run(request.text, request.voice, request.seed)
    except encode_once.EncodeError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)


def demo_encode(text, voice):
    """The browsable version: audio to play, and what decoding read back."""
    if not text.strip():
        return None, "Type something first."
    result = run(text, voice)
    # gr.Audio(type="filepath") wants a path, not bytes. The Space's disk is
    # ephemeral and this is a preview, so a temp file is the whole lifecycle.
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.write(base64.b64decode(result["wavBase64"]))
    tmp.close()
    accuracy = round(result["decodeAccuracy"] * 100)
    read_back = (
        f"Sung as: {result['normalizedText']}\n"
        f"Read back: {result['decodedText']}\n"
        f"Decode accuracy: {accuracy}%"
    )
    return tmp.name, read_back


with gr.Blocks(title="CICI BIRD encoder") as demo:
    gr.Markdown(
        "# CICI BIRD encoder\n"
        "Type a sentence and hear it sung by a DDSP model trained on real "
        "recordings, then read back by the same decoder that has to recover "
        "it. Letters map to a 31-symbol alphabet (`a-z`, space, `.,'?`); "
        "anything else becomes a pause."
    )
    with gr.Row():
        text_in = gr.Textbox(
            label="Message", max_length=MAX_CHARS,
            placeholder="meet me by the river at six.")
        voice_in = gr.Dropdown(VOICES, value=VOICES[0], label="Voice")
    go = gr.Button("Encode", variant="primary")
    audio_out = gr.Audio(label="Birdsong", type="filepath")
    text_out = gr.Textbox(label="Decoded back", lines=3)
    go.click(demo_encode, [text_in, voice_in], [audio_out, text_out],
             api_name="encode")


app = gr.mount_gradio_app(api, demo, path="/")


def warm():
    """Pay every cold start once, at boot, not on a visitor's first click."""
    for slug in VOICES:
        run("warm", slug)
    print("warm: all three voices loaded", flush=True)


if __name__ == "__main__":
    warm()
    uvicorn.run(app, host="0.0.0.0", port=PORT)
