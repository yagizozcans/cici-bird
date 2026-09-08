"""
Generate the "real bird voices" data behind a Lab entry: five field recordings
of the bird itself, and what our decoder reads out of each one.

WHY THIS SCRIPT EXISTS
----------------------
Everything else the site plays for these three birds is OUR audio — a message
the model sang. The decoder is closed-set (ml/generate.py:777): it always
returns its best explanation, so pointing it at a wild recording produces
confident-looking nonsense. That is not a bug to hide, it is the clearest way
to show what the alphabet is: a protocol we imposed on a voice, not a language
the bird is speaking. So this script plays the wild bird and prints what the
Viterbi search claims it said, next to the score that says do not believe it.

The text is MEASURED, never written. Each clip is encoded to the same m4a the
visitor streams, decoded back OUT of that m4a, and the letters the decoder
returns are what the page shows. Re-encoding first matters: AAC at 64 kbps is
what the browser plays, so decoding the pre-encoding float array would report
a reading of audio nobody hears.

LICENSING DECIDES WHICH CLIPS
-----------------------------
The corpora are mostly CC BY-NC-SA / BY-NC-ND — non-commercial, so unusable on
a site that sells an app, which is exactly why every existing corpus-sourced
asset in the manifest is marked unverified and blocks the launch gate. Only the
BY-SA slice can actually ship: 11 clips for the wren, 64 for the sparrow, 24
for the cardinal, all of them songs. This script selects from that slice only,
and records the recordist, the xeno-canto id and the licence per clip so the
page renders a real credit rather than a placeholder.

The wren's whole BY-SA slice is ONE recording (XC109668), so its five clips are
five three-second passages of one bird's session rather than five birds. That
is a property of what is licensable, not a choice, so `sourceRecordings` in the
meta says how many distinct recordings the five came from and the page shows it.

THE CHECKPOINT CONTRACT
-----------------------
Same as scripts/generate_lab.py: the decoded text is a property of ONE
checkpoint (its template bank is built from that model's own renderings), so
the file records the checkpoint and takes it from the manifest by default.
src/data/lab.ts refuses a file measured against a different model than the
audio the site plays, and scripts/check-launch.mjs reports a stale one first.

Run:  cd website && ../.venv/bin/python scripts/generate_wild_voices.py
      (torch lives in the project venv; system python3 will not have it)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine"
ML = ROOT / "ml"
MANIFEST = ROOT / "website" / "public" / "audio" / "manifest.json"
OUT_DIR = ROOT / "website" / "src" / "data" / "lab"
AUDIO_DIR = ROOT / "website" / "public" / "audio" / "wild"

sys.path.insert(0, str(ENGINE))
sys.path.insert(0, str(ML))
# The ml/ modules resolve their feature caches and checkpoints relative to the
# working directory, exactly as they do when run from ml/ by hand.
os.chdir(ML)

from birdsong_codec import SAMPLE_RATE, load_wav, save_wav  # noqa: E402
import generate_species as G  # noqa: E402

N_CLIPS = 5
FADE_S = 0.03
# xeno-canto's csv stores protocol-relative urls ("//xeno-canto.org/..."), which
# would resolve against the site's own origin in an href.
HTTPS = lambda u: f"https:{u}" if u.startswith("//") else u  # noqa: E731

# Only these can ship. See the licensing note above.
USABLE_LICENSE = "by-sa"

LICENSE_NAMES = {
    "by-sa/3.0": "CC BY-SA 3.0",
    "by-sa/4.0": "CC BY-SA 4.0",
}


def license_name(url: str) -> str:
    for frag, name in LICENSE_NAMES.items():
        if frag in url:
            return name
    raise SystemExit(f"unknown licence {url!r} — add it to LICENSE_NAMES")


_BANK_SEED = 20260909


def decoder(key: str, ckpt: Path):
    """audio -> (text, score) for this bird, using its own decoder.

    The Bewick's wren predates the species registry: its motifs, template bank
    and Viterbi search live in ml/generate.py rather than generate_species.py.
    Same algorithm, different home, so it is adapted here rather than copied.

    The bank is built HERE, under a fixed seed, rather than lazily on the first
    decode. It is made by rendering each symbol through the model, and the
    synth's noise branch draws from torch's global RNG (ml/synth.py) — so an
    unseeded build gives every run a slightly different bank and therefore
    slightly different scores. Measured across two runs that was ±0.001 on the
    score, which is nothing next to a 0.163 threshold, but it also flipped one
    wren clip's reading from "l" to "ll". The page publishes that string, so it
    has to be reproducible: same corpus, same checkpoint, same letters.
    """
    torch.manual_seed(_BANK_SEED)
    if key == "bewicks_wren":
        import generate as W  # noqa: E402  (wren-only)

        W._template_bank(str(ckpt))
        return (lambda a: W.decode_natural(a, str(ckpt), return_score=True),
                "ml/generate.py")
    G.template_bank(G.SP.get(key), str(ckpt))
    return (lambda a: G.decode(a, key, str(ckpt), return_score=True),
            "ml/generate_species.py")


def select(rows: list[dict], corpus: Path) -> list[dict]:
    """The five clips, chosen so the choice is reproducible and defensible.

    Round-robin over the licensable RECORDINGS, taking clips spread across each
    recording's segments. Round-robin because the interesting variation is
    between birds, not between two consecutive seconds of the same bird; spread
    because consecutive segments of one song bout decode to the same letters
    (measured: the wren's 109668-0 and 109668-1 both read "il ll").
    """
    usable = [r for r in rows
              if USABLE_LICENSE in r["license"]
              and "song" in r["sound_type"].lower()
              and (corpus / "wavfiles" / r["filename"]).is_file()]
    if len(usable) < N_CLIPS:
        raise SystemExit(f"only {len(usable)} usable clips — need {N_CLIPS}")

    by_rec: dict[str, list[dict]] = {}
    for r in usable:
        by_rec.setdefault(r["id"], []).append(r)
    # Sort by segment index, not filename: "-10" sorts before "-2" as a string.
    seg = lambda r: int(r["filename"].rsplit("-", 1)[1].split(".")[0])  # noqa: E731
    for group in by_rec.values():
        group.sort(key=seg)

    order = sorted(by_rec, key=lambda i: int(i))
    picked, round_ = [], 0
    while len(picked) < N_CLIPS:
        took = False
        for rid in order:
            group = by_rec[rid]
            # Spread: on round r take the clip r/N_CLIPS of the way in.
            wanted = min(round_ * max(1, len(group) // N_CLIPS), len(group) - 1)
            while wanted < len(group) and group[wanted] in picked:
                wanted += 1
            if wanted < len(group):
                picked.append(group[wanted])
                took = True
                if len(picked) == N_CLIPS:
                    break
        if not took:
            raise SystemExit("ran out of clips while spreading")
        round_ += 1
    return picked


def prepare(path: Path) -> np.ndarray:
    """The corpus clip as the site will play it: mono, faded, peak-normalised.

    The corpus stores 3.0 s float wavs at 22.05 kHz, already the site's rate,
    so nothing is resampled. Levels vary by tens of dB between recordings and a
    row of players that jump in volume is just unpleasant, so each is brought
    to the same peak — which is scale-invariant for the decoder anyway, since
    its energy veto is relative to the clip's own 75th percentile.
    """
    samples = load_wav(str(path)) if path.suffix == ".wav" else None
    if samples is None:
        raise SystemExit(f"not a wav: {path}")
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    clip = samples.astype(np.float32).copy()
    fade = int(FADE_S * SAMPLE_RATE)
    if len(clip) > 2 * fade:
        clip[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
        clip[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    peak = float(np.abs(clip).max())
    return (clip / peak) * 0.9 if peak > 0 else clip


def to_m4a(samples: np.ndarray, dest: Path) -> None:
    """float samples -> AAC in an MP4 container, as scripts/generate_audio.py."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "src.wav"
        save_wav(str(wav), samples)
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000",
             str(wav), str(dest)],
            check=True, capture_output=True,
        )


def from_m4a(src: Path) -> np.ndarray:
    """Read an m4a back to float samples — what the browser actually decodes."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "back.wav"
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", f"LEI16@{SAMPLE_RATE}", "-c", "1",
             str(src), str(wav)],
            check=True, capture_output=True,
        )
        return load_wav(str(wav))


def m4a_duration(path: Path) -> float:
    out = subprocess.run(["afinfo", str(path)], check=True, capture_output=True,
                         text=True).stdout
    for line in out.splitlines():
        if "estimated duration" in line:
            return round(float(line.split(":")[1].strip().split()[0]), 3)
    return 0.0


def one(a, manifest: dict, key: str) -> None:
    slug = key.replace("_", "-")
    voice = manifest.get("trainedVoices", {}).get(slug)
    if voice is None:
        raise SystemExit(f"{slug}: no trained voice in {MANIFEST.relative_to(ROOT)} "
                         f"— there is no decoder to read a wild clip with")

    checkpoint = a.checkpoint or voice["model"]
    matches = checkpoint == voice["model"]
    if not matches and not a.allow_checkpoint_mismatch:
        raise SystemExit(
            f"checkpoint {checkpoint} is not the manifest's {voice['model']}. "
            f"The decoder's template bank is built from the model's own "
            f"renderings, so a different one reads different letters than the "
            f"site's audio was measured with. Pass --allow-checkpoint-mismatch "
            f"if that is what you want.")
    ckpt_path = ROOT / checkpoint
    if not ckpt_path.is_file():
        raise SystemExit(f"no such checkpoint {checkpoint}")

    corpus = ROOT / voice["corpus"]
    rows = list(csv.DictReader((corpus / "metadata.csv").open()))
    picked = select(rows, corpus)
    read, decoder_module = decoder(key, ckpt_path)
    threshold = voice["identification"]["threshold"]

    print(f"{slug}: {len(picked)} clips from "
          f"{len({r['id'] for r in picked})} recording(s)")

    clips = []
    for n, r in enumerate(picked, 1):
        rel = f"/audio/wild/{slug}-{n}.m4a"
        dest = ROOT / "website" / "public" / rel.lstrip("/")
        to_m4a(prepare(corpus / "wavfiles" / r["filename"]), dest)
        text, score = read(from_m4a(dest))
        clips.append(dict(
            id=f"wild-{slug}-{n}", src=rel, mime="audio/mp4",
            bytes=dest.stat().st_size, durationSec=m4a_duration(dest),
            file=r["filename"],
            sourceId=f"XC{r['id']}", sourceUrl=HTTPS(r["source_url"]),
            recordist=r["recordist"], license=license_name(r["license"]),
            licenseUrl=HTTPS(r["license"]),
            country=r["country"], location=r["location"], date=r["date"],
            soundType=r["sound_type"],
            decoded=dict(text=text, score=round(float(score), 4),
                         isMessage=bool(score >= threshold)),
        ))
        d = clips[-1]["decoded"]
        print(f"  {rel:34s} XC{r['id']:<8s} score {d['score']:+.4f}  {d['text']!r}")

    believed = [c for c in clips if c["decoded"]["isMessage"]]
    meta = dict(
        species=G.SP.get(key).name, key=key, speciesSlug=slug,
        checkpoint=checkpoint, checkpointMatchesManifest=matches,
        manifestGeneratedAt=manifest["generatedAt"],
        generatedAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        generator="website/scripts/generate_wild_voices.py",
        decoder=decoder_module,
        corpus=voice["corpus"],
        # How many of the corpus's clips could legally be shown at all, and how
        # many distinct recordings the five came from. Both are the honest
        # denominator for "we picked these five".
        licensablePool=len([r for r in rows if USABLE_LICENSE in r["license"]]),
        corpusClips=len(rows),
        sourceRecordings=len({c["sourceId"] for c in clips}),
        sampleRate=SAMPLE_RATE, nClips=len(clips),
        # The scores this bird's threshold was calibrated against, so the page
        # can put a wild clip's score next to both ends of the scale.
        threshold=threshold,
        messageScore=voice["identification"]["messageScore"],
        # If this is ever non-empty the section's whole claim is wrong, and the
        # page must not go on saying "none of these is a message".
        readAsMessage=[c["id"] for c in believed],
    )

    out = OUT_DIR / f"{slug}-wild-voices.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(dict(meta=meta, clips=clips),
                              separators=(",", ":"), sort_keys=True) + "\n")
    scores = [c["decoded"]["score"] for c in clips]
    print(f"  wrote {out.relative_to(ROOT)}  "
          f"scores {min(scores):+.4f}..{max(scores):+.4f}, "
          f"threshold {threshold:+.4f}, "
          f"{len(believed)} read as a message")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--species", default=None,
                    help="ml species key (see ml/species.py); default: every "
                         "trained voice in the manifest")
    ap.add_argument("--checkpoint", default=None,
                    help="root-relative .pt path; default: the manifest's "
                         "trainedVoices[slug].model")
    ap.add_argument("--allow-checkpoint-mismatch", action="store_true",
                    help="decode with a checkpoint the site's audio was NOT "
                         "rendered with (the site will refuse the file)")
    a = ap.parse_args()

    for tool in ("afconvert", "afinfo"):
        if subprocess.run(["which", tool], capture_output=True).returncode:
            raise SystemExit(f"`{tool}` not found — this script targets macOS")

    manifest = json.loads(MANIFEST.read_text())
    keys = ([a.species] if a.species
            else [s.replace("-", "_") for s in manifest.get("trainedVoices", {})])
    if not keys:
        raise SystemExit("no trained voices in the manifest — nothing to decode")
    if a.checkpoint and not a.species:
        raise SystemExit("--checkpoint names one bird; pass --species too")
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    for key in keys:
        one(a, manifest, key)


if __name__ == "__main__":
    main()
