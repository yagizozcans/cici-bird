#!/usr/bin/env bash
# Assemble the Hugging Face Space directory.
#
# The Space is BUILT, never hand-maintained: it is a copy of the files the
# encoder actually imports, laid out the way the repo lays them out, so
# generate_audio.py's parents[2] still resolves and nothing needs editing for
# the deploy. Re-run this after changing ml/, engine/, encode_once.py or the
# motifs, then commit and push inside dist/space.
#
# The Space uses the Gradio SDK, so there is no Dockerfile: Hugging Face
# installs requirements.txt itself and runs app.py.
#
# Deliberately NOT copied: data/, the feature caches, website/ beyond the two
# scripts. If the Space ever needs one of those, the frozen motifs have stopped
# doing their job and that is the thing to fix.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"
out="$root/dist/space"

rm -rf "$out"
mkdir -p "$out/ml" "$out/engine" "$out/website/scripts"

cp "$root"/ml/*.py                        "$out/ml/"

# The three checkpoints the site ships, not all eleven in ml/checkpoints. The
# rest are training history — baselines, width and window experiments — and
# publishing them would say they are shipped voices when they are not.
mkdir -p "$out/ml/checkpoints"
for ckpt in wren.pt sparrow_win256.pt cardinal_best250.pt; do
  cp "$root/ml/checkpoints/$ckpt" "$out/ml/checkpoints/"
done
cp "$root"/engine/*.py                    "$out/engine/"
cp "$root"/website/scripts/generate_audio.py "$out/website/scripts/"
cp "$root"/website/scripts/encode_once.py    "$out/website/scripts/"
cp "$here"/{requirements.txt,app.py,preload.py,motifs.json} "$out/"
cp "$here"/SPACE_README.md                "$out/README.md"

# Hugging Face seeds a new Space with a .gitattributes that routes *.pt through
# Git LFS. Ours are 556 KB each, far under the 10 MB above which the Hub
# actually requires LFS, so that rule buys nothing and costs a git-lfs install
# — without which `git add` fails outright with "git-lfs: command not found".
# Overwrite it: mark the checkpoints binary so no newline conversion touches
# them, and commit them as ordinary blobs.
cat > "$out/.gitattributes" <<'ATTR'
*.pt binary
ATTR

# ml/species.py refuses a species whose clip directory is missing. The clips
# are never read — the frozen motifs replace them — but the guard runs first.
# .gitkeep because git does not track empty directories, and this tree is
# pushed to the Space as a git repo; without it the dirs would vanish in
# transit and the container would only fail once it was live.
for sub in bewicks_wren song_sparrow northern_cardinal; do
  mkdir -p "$out/data/$sub/wavfiles"
  touch "$out/data/$sub/wavfiles/.gitkeep"
done

echo "assembled $out ($(du -sh "$out" | cut -f1))"
find "$out" -type f | sed "s|$out|  .|" | sort
