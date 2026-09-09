"""Preload the frozen motifs so nothing reaches for the corpus.

ml/generate.py and ml/generate_species.py both cache their shape library in a
module global and build it lazily from the recordings. Filling those caches
before the first render means the build never runs — so the container needs
neither the 3.6 GB corpus nor the 65 MB feature caches, only motifs.json.

The two modules cache differently because they were written apart: the wren
keeps one un-keyed library (it is wren-only), the species generator keys by
species. Both are populated here rather than unified — see the encoder commit
for why merging them is a separate job with its own reproduction bar.

`assert_offline()` is not decoration. If a future change makes something reach
past the motifs, the failure must be a loud error at startup and not a
silently different bird.
"""
import json
import os

import numpy as np

MOTIFS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "motifs.json")


def _pairs(bank):
    """The stored bank -> (library, symbol->index), the shape ml/ expects."""
    order = list(bank)
    lib = [(np.array(bank[ch][0], np.float32),
            np.array(bank[ch][1], np.float32),
            bank[ch][2]) for ch in order]
    return lib, {ch: i for i, ch in enumerate(order)}


def preload():
    import generate as wren
    import generate_species as gs

    with open(MOTIFS) as fh:
        banks = json.load(fh)

    wren._SHAPE_LIBRARY, wren._MOTIF_ASSIGNMENT = _pairs(banks["bewicks_wren"])
    for key in ("song_sparrow", "northern_cardinal"):
        gs._LIB[key], gs._ASSIGN[key] = _pairs(banks[key])

    return wren, gs


def assert_offline(wren, gs):
    """Make any read of the corpus or the feature caches a crash, not a voice.

    Not by refusing the library builders: both generators call theirs on EVERY
    note (`_note_for_symbol` -> `_build_shape_library`, `note_for` ->
    `shape_library`), relying on them to return the cached library. Refusing
    those refuses the whole encoder — which is how this was first written, and
    the guard caught it. So the builders become pure readers of what preload()
    filled in, and they raise loudly if it is empty; the tripwire goes on the
    functions that actually touch disk, which nothing should now reach.
    """
    def refuse(*_a, **_k):
        raise RuntimeError(
            "the corpus is not deployed — something asked for it past the "
            "frozen motifs; regenerate service/motifs.json")

    def wren_library():
        if wren._SHAPE_LIBRARY is None:
            refuse()
        return wren._SHAPE_LIBRARY

    def species_library(sp, max_clips=250):
        if sp.key not in gs._LIB:
            refuse()
        return gs._LIB[sp.key]

    wren._build_shape_library = wren_library
    gs.shape_library = species_library

    # These are the only functions that open a recording or a feature cache.
    # With the builders above they are unreachable; if that ever stops being
    # true, this is where it surfaces.
    gs.subset = refuse
    gs.load_cache = refuse
    gs.list_clips = refuse
