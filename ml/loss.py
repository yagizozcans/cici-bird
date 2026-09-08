"""
The LOSS — one number saying "how wrong is the generated audio?" (ML-3, step 3).

THE KEY LESSON: do NOT compare audio waveforms sample-by-sample.

Two sounds can be perceptually identical yet have totally different waveforms,
because shifting the phase (where each wave starts) changes every sample value
but not what you hear. So an L1/L2 loss on raw samples would punish the model
for differences nobody can hear, and it would never converge.

Instead we compare SPECTROGRAMS — how much energy sits at each frequency over
time — which is close to what the ear actually perceives. And we do it at
MULTIPLE FFT sizes ("multi-scale"): big windows see fine frequency detail but
blur timing; small windows see sharp timing but coarse frequency. Summing across
scales captures both the pitch content and the rhythmic/transient structure.
This is the standard DDSP training objective.
"""

import torch

FFT_SIZES = [2048, 1024, 512, 256, 128, 64]


def _stft_mag(x: torch.Tensor, n_fft: int) -> torch.Tensor:
    window = torch.hann_window(n_fft, device=x.device)
    spec = torch.stft(x, n_fft=n_fft, hop_length=n_fft // 4,
                      window=window, return_complex=True, center=True)
    return spec.abs()


def multiscale_spectral_loss(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    """pred, target: [batch, n_samples]. Returns a scalar loss."""
    loss = pred.new_zeros(())
    for n_fft in FFT_SIZES:
        sp, st = _stft_mag(pred, n_fft), _stft_mag(target, n_fft)
        loss = loss + (sp - st).abs().mean()                          # linear magnitude
        loss = loss + (torch.log(sp + 1e-5) - torch.log(st + 1e-5)).abs().mean()  # log
    return loss


if __name__ == "__main__":
    # Sanity check the loss behaves like a distance: 0 for identical audio,
    # large for unrelated audio, medium for a slightly-different version.
    torch.manual_seed(0)
    a = torch.randn(1, 22050)
    same = a.clone()
    different = torch.randn(1, 22050)
    similar = a + 0.05 * torch.randn(1, 22050)

    print(f"loss(a, a)         = {multiscale_spectral_loss(a, same):.4f}   (should be ~0)")
    print(f"loss(a, similar)   = {multiscale_spectral_loss(a, similar):.4f}   (small)")
    print(f"loss(a, different) = {multiscale_spectral_loss(a, different):.4f}   (large)")
