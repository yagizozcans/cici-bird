"""The hosted encoder, as a Gradio Space.

Why this exists: encoding needs torch, the checkpoints and a motif library, and
the site deploys `website/` to Vercel alone — where torch is ~200 MB against a
250 MB function limit. So the Next route calls this when ENCODE_SERVICE_URL is
set and shells out to the same `encode_once.encode` locally when it is not.
There is one renderer; only the transport differs.

THE SPACE OWNS THE SERVER, NOT US. An earlier version mounted FastAPI, added a
plain `POST /encode`, and ran its own uvicorn on 7860. It died on the Hub with
"[Errno 98] address already in use": the Gradio runtime has already bound that
port by the time app.py runs. So this is now the canonical shape — build
`demo`, call `demo.launch()`, and let the platform do the rest — and the site
talks to it through Gradio's own API instead of a route of ours.

TWO FUNCTIONS, ONE RENDERER. `demo_encode` drives the visible demo and returns
something a person can listen to. `api_encode` returns the exact JSON the site
needs, as a string, and is wired to hidden components purely to give it an
`api_name`. Both call `run()`.

ONE ENCODE AT A TIME, deliberately. ml/generate.py mutates a module-global
_SIG_MEAN inside _template_bank, so decoding two checkpoints concurrently in
one interpreter mis-centres one of them. Encoding is ~0.5 s once warm, so the
queue is short, and the alternative is a wrong answer rather than a slow one.

The corpus is NOT here. preload.py fills the shape-library caches from
motifs.json first, then makes every route back to the recordings raise, so a
regression is a crash at startup rather than a bird that quietly changed.
"""
import base64
import json
import os
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.abspath(__file__))
for _sub in ("engine", "ml", os.path.join("website", "scripts")):
    sys.path.insert(0, os.path.join(ROOT, _sub))

import gradio as gr                                       # noqa: E402

import preload                                            # noqa: E402

_wren, _gs = preload.preload()
preload.assert_offline(_wren, _gs)

import encode_once                                        # noqa: E402

VOICES = ["bewicks-wren", "song-sparrow", "northern-cardinal"]
MAX_CHARS = 80

_lock = threading.Lock()


# ZeroGPU refuses to start a Space with no GPU-decorated function at all: "No
# @spaces.GPU function detected during startup". On the free tier a Gradio
# Space only runs on ZeroGPU, so one has to exist — even though nothing here
# wants a GPU. This is never called; `_load_net` maps to cpu and both synth
# passes are plain tensor math. The import is optional so the same file still
# runs locally and anywhere that is not ZeroGPU.
try:
    import spaces                                         # noqa: E402

    @spaces.GPU(duration=1)
    def _zerogpu_marker():
        """Exists so ZeroGPU's startup check finds something. Never called."""
        return "ok"
except Exception:  # pragma: no cover - only ZeroGPU provides this package
    pass


def run(text, voice, seed=0):
    """The one entry point both surfaces use. Serialized; see the docstring."""
    if voice not in VOICES:
        raise encode_once.EncodeError(f"unknown voice {voice!r}")
    if not text.strip():
        raise encode_once.EncodeError("empty text")
    with _lock:
        return encode_once.encode(text[:MAX_CHARS], voice, seed)


def api_encode(text, voice):
    """The site's endpoint. Returns the payload as a JSON string.

    A string rather than a dict because Gradio types an output component, and
    a Textbox carrying JSON survives the call/poll round trip unchanged — the
    site parses it. Errors come back as {"error": ...} with a 200, since the
    caller has to read the body either way.
    """
    try:
        return json.dumps(run(text, voice))
    except encode_once.EncodeError as exc:
        return json.dumps({"error": str(exc)})


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
    return tmp.name, (
        f"Sung as: {result['normalizedText']}\n"
        f"Read back: {result['decodedText']}\n"
        f"Decode accuracy: {round(result['decodeAccuracy'] * 100)}%"
    )


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

    # The site's endpoint. Hidden because it has no business on the page — the
    # components exist only so the click has an api_name to be reached by.
    with gr.Row(visible=False):
        api_text = gr.Textbox()
        api_voice = gr.Textbox()
        api_out = gr.Textbox()
        api_go = gr.Button()
    api_go.click(api_encode, [api_text, api_voice], api_out,
                 api_name="encode_json")


def warm():
    """Pay every cold start once, at import, not on a visitor's first click."""
    for slug in VOICES:
        run("warm", slug)
    print("warm: all three voices loaded", flush=True)


warm()

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", 7860)))
