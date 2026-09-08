"""
Shared constants for the DDSP bird-synthesis subsystem.

Every other ml/ file imports from here, so there is ONE place that defines
"how many samples per second" etc. If these lived in each file, they would
drift out of sync — a classic, painful bug. One source of truth.
"""

import torch

# Audio. We match the dataset + codec at 22050 Hz so nothing ever needs
# resampling. (DDSP often uses 16 kHz to save compute; 22050 is fine on the GPU.)
SAMPLE_RATE = 22050

# The harmonic oscillator sums this many sine waves (fundamental + overtones).
# More harmonics = richer timbre the model can shape, but more compute.
N_HARMONICS = 60

# Control signals ("knobs") are produced at a lower FRAME rate, then smoothly
# upsampled to audio rate. The net doesn't need to decide a new pitch 16000
# times a second — 250 times is plenty and far cheaper.
HOP = 64
FRAME_RATE = SAMPLE_RATE // HOP          # 250 control frames per second

# Use the Apple-Silicon GPU when available, else CPU.
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
