"""The hosted encoder: POST /encode, one bird's voice per request.

Why this exists at all: encoding needs torch, the checkpoints and a motif
library, and the site deploys `website/` to Vercel alone. The Next route calls
this service when ENCODE_SERVICE_URL is set and shells out to the same
`encode_once.encode` locally when it is not, so the two paths cannot render
different audio — there is one implementation and this only wraps it.

The corpus is NOT here. preload.py fills the shape-library caches from
motifs.json first, and then makes every route back to the recordings raise, so
a regression is a 500 at startup rather than a bird that quietly changed.

ONE ENCODE AT A TIME, deliberately. ml/generate.py mutates a module-global
_SIG_MEAN inside _template_bank, so decoding two checkpoints concurrently in
one interpreter mis-centres one of them. The CLI avoids this with a process per
request; a long-lived server has to take a lock. Encoding is ~0.5s once warm,
so the queue is short, and the alternative is a wrong answer rather than a slow
one.

Everything is warmed at import: all three nets loaded and all three template
banks built, so the first visitor does not pay for the last one's cold start.
"""
import os
import sys
import threading

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "engine"))
sys.path.insert(0, os.path.join(ROOT, "ml"))
sys.path.insert(0, os.path.join(ROOT, "website", "scripts"))

from fastapi import FastAPI                              # noqa: E402
from fastapi.middleware.cors import CORSMiddleware       # noqa: E402
from fastapi.responses import JSONResponse               # noqa: E402
from pydantic import BaseModel, Field                    # noqa: E402

import preload                                           # noqa: E402

_wren, _gs = preload.preload()
preload.assert_offline(_wren, _gs)

import encode_once                                       # noqa: E402

VOICES = ["bewicks-wren", "song-sparrow", "northern-cardinal"]
MAX_CHARS = 80

# Only the site may call this from a browser. Set to the deployed origin; the
# default is deliberately restrictive rather than "*", because an open endpoint
# is a free CPU faucet.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://cici-bird.vercel.app")

_lock = threading.Lock()

app = FastAPI(title="cici bird encoder")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["POST"],
    allow_headers=["content-type"],
)


class EncodeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)
    voice: str
    seed: int = 0


@app.on_event("startup")
def warm():
    """Pay every cold start once, here, instead of on a visitor's first click."""
    for slug in VOICES:
        encode_once.encode("warm", slug)
    print("warm: all three voices loaded", flush=True)


@app.get("/health")
def health():
    return {"ok": True, "voices": VOICES}


@app.post("/encode")
def post_encode(request: EncodeRequest):
    if request.voice not in VOICES:
        return JSONResponse({"error": "unknown voice"}, status_code=400)
    if not request.text.strip():
        return JSONResponse({"error": "empty text"}, status_code=400)
    try:
        with _lock:
            return encode_once.encode(request.text[:MAX_CHARS], request.voice,
                                      request.seed)
    except encode_once.EncodeError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
