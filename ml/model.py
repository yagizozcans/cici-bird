"""
The MODEL — the only part with learnable weights (ML-3, step 2).

Job: given the two control features (f0, loudness) at each moment, decide the
TIMBRE — i.e., the harmonic knobs the synth needs:

    (f0, loudness)  ──▶  net  ──▶  overall amplitude  +  harmonic distribution

That's the whole DDSP "decoder". It does NOT decide pitch — pitch comes from the
data's f0 and drives the oscillator directly. The net only learns how the bird's
sound is *coloured* at each pitch/loudness, which is exactly what "timbre" means.

Architecture (small on purpose): per-frame MLP → GRU (gives it short-term memory
of what came just before, so notes connect) → output heads.
"""

import torch
import torch.nn as nn

from config import N_HARMONICS, SAMPLE_RATE
from synth import N_NOISE_BANDS


def scaled_sigmoid(x: torch.Tensor) -> torch.Tensor:
    """Keep amplitudes positive and nicely bounded (DDSP's activation)."""
    return 2.0 * torch.sigmoid(x) ** 2.3 + 1e-7


class DDSPDecoder(nn.Module):
    def __init__(self, n_harmonics: int = N_HARMONICS, hidden: int = 128,
                 n_in: int = 2):
        """n_in=2 -> (f0, loudness), the original. n_in=3 adds spectral
        CENTROID, because those two alone leave most of the timbral variation
        undetermined (59% for the sparrow) and the model can then only render
        the average colour. Old checkpoints are 2-input; loaders infer n_in
        from the weights rather than assuming."""
        super().__init__()
        self.n_in = n_in
        self.encode = nn.Sequential(
            nn.Linear(n_in, hidden), nn.LayerNorm(hidden), nn.LeakyReLU(),
        )
        self.gru = nn.GRU(hidden, hidden, batch_first=True)   # temporal memory
        self.post = nn.Sequential(
            nn.Linear(hidden, hidden), nn.LeakyReLU(),
        )
        self.amp_head = nn.Linear(hidden, 1)                  # overall loudness knob
        self.harm_head = nn.Linear(hidden, n_harmonics)       # harmonic mix knobs
        self.noise_head = nn.Linear(hidden, N_NOISE_BANDS)    # filtered-noise knobs

    def forward(self, f0: torch.Tensor, loudness: torch.Tensor,
                centroid: torch.Tensor = None):
        # each [batch, frames]. Normalize so all channels are ~0..1 scale.
        chans = [f0 / (SAMPLE_RATE / 2), loudness * 3.0]
        if self.n_in == 3:
            if centroid is None:
                raise ValueError("this model was trained with centroid "
                                 "conditioning; pass centroid=")
            chans.append(centroid / (SAMPLE_RATE / 2))
        x = torch.stack(chans, dim=-1)                       # [B,frames,n_in]
        h = self.encode(x)
        h, _ = self.gru(h)
        h = self.post(h)
        amplitude = scaled_sigmoid(self.amp_head(h)).squeeze(-1)          # [B,frames]
        harmonic_distribution = self.harm_head(h)                        # [B,frames,K]
        noise_magnitudes = scaled_sigmoid(self.noise_head(h))            # [B,frames,bands]
        return amplitude, harmonic_distribution, noise_magnitudes


if __name__ == "__main__":
    from synth import synthesize

    B, frames = 2, 300
    f0 = torch.full((B, frames), 3000.0)
    loudness = torch.rand(B, frames) * 0.3

    net = DDSPDecoder()
    amp, harm, noise = net(f0, loudness)
    audio = synthesize(f0, amp, harm, noise, n_samples=frames * 64)

    n_params = sum(p.numel() for p in net.parameters())
    print(f"model params: {n_params:,}")
    print(f"amp out: {tuple(amp.shape)}, harmonic dist: {tuple(harm.shape)}")
    print(f"synth audio: {tuple(audio.shape)}  (untrained -> will sound like noise)")
