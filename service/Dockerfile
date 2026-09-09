# Hugging Face Spaces runs this on free CPU. Nothing here needs a GPU: the
# encoder loads checkpoints with map_location="cpu" and never calls .to(DEVICE).
FROM python:3.9-slim

# soundfile is a libsndfile binding, not a pure-Python decoder.
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Spaces runs the container as uid 1000, and HF's own tooling writes to $HOME.
RUN useradd -m -u 1000 app
USER app
ENV PATH=/home/app/.local/bin:$PATH
WORKDIR /home/app/space

COPY --chown=app requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# The layout mirrors the repo on purpose: generate_audio.py resolves ml/ and
# engine/ from its own path (parents[2]), so it runs here unmodified rather
# than in a rewritten copy that could drift from the one building the site.
COPY --chown=app ml/ ml/
COPY --chown=app engine/ engine/
COPY --chown=app website/scripts/ website/scripts/
COPY --chown=app app.py preload.py motifs.json ./

# ml/species.py refuses a species whose clip directory is missing. The clips
# themselves are never read — the frozen motifs replace them — but the guard
# runs before anything knows that, so give it the directories it checks for.
RUN mkdir -p data/bewicks_wren/wavfiles \
             data/song_sparrow/wavfiles \
             data/northern_cardinal/wavfiles

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
