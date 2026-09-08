"""
The differentiable HARMONIC SYNTHESIZER  (ML-2).

This is the "frozen physics" half of DDSP: it has NO learnable weights. It's the
exact additive synth you built by hand in synth_plus.py (a fundamental plus
harmonics), but rewritten in PyTorch so that gradients can flow *backwards*
through it during training. That single property — differentiability — is what
lets a network later learn to drive it.

It takes three CONTROL SIGNALS (the "knobs") and returns audio:

    f0                    : the pitch over time            [batch, frames]
    amplitude             : overall loudness over time     [batch, frames]
    harmonic_distribution : how loud each harmonic is      [batch, frames, K]

Nothing here knows about neural networks or birds. It just turns knobs into sound.
"""

import torch
import torch.nn.functional as F

from config import SAMPLE_RATE, N_HARMONICS


def upsample(signal: torch.Tensor, n_samples: int) -> torch.Tensor:
    """Stretch a low-rate control signal up to audio rate, smoothly.

    signal: [batch, frames, channels] -> [batch, n_samples, channels].
    The net decides knobs 250x/sec; the ear hears 16000x/sec. We linearly
    interpolate between control frames so the knobs glide instead of stepping.
    """
    signal = signal.transpose(1, 2)                       # [B, C, frames]
    signal = F.interpolate(signal, size=n_samples, mode="linear", align_corners=True)
    return signal.transpose(1, 2)                         # [B, n_samples, C]


def harmonic_synth(f0: torch.Tensor,
                   amplitude: torch.Tensor,
                   harmonic_distribution: torch.Tensor,
                   n_samples: int,
                   sample_rate: int = SAMPLE_RATE) -> torch.Tensor:
    """Additive synthesis: sum of harmonically-related sine waves.

    Returns audio of shape [batch, n_samples] in roughly [-1, 1].
    """
    batch, frames = f0.shape
    K = harmonic_distribution.shape[-1]

    # 1. Turn the raw "distribution" numbers into clean positive weights that
    #    sum to 1 per frame. softmax is a differentiable way to say "these are
    #    relative loudnesses of the harmonics."
    hd = torch.softmax(harmonic_distribution, dim=-1)             # [B, frames, K]

    # 2. Anti-aliasing: a harmonic above the Nyquist limit (sample_rate/2) can't
    #    be represented and would fold back as an ugly false tone. Silence those.
    harmonic_numbers = torch.arange(1, K + 1, device=f0.device).float()   # [K]
    freqs = f0.unsqueeze(-1) * harmonic_numbers                   # [B, frames, K]
    hd = hd * (freqs < sample_rate / 2).float()
    hd = hd / (hd.sum(-1, keepdim=True) + 1e-7)                   # renormalize

    # 3. Each harmonic's amplitude = overall loudness * its share.
    amps = amplitude.unsqueeze(-1) * hd                          # [B, frames, K]

    # 4. Upsample controls to audio rate.
    amps = upsample(amps, n_samples)                            # [B, n_samples, K]
    f0_up = upsample(f0.unsqueeze(-1), n_samples)              # [B, n_samples, 1]

    # 5. Phase is the running sum of angular frequency (same cumsum trick you
    #    already used to make pitch glide). Then each harmonic k rides at k*phase.
    omega = 2 * torch.pi * f0_up / sample_rate                  # per-sample step
    phase = torch.cumsum(omega, dim=1)                          # [B, n_samples, 1]
    phases_k = phase * harmonic_numbers                         # [B, n_samples, K]

    # 6. Sum the sines, weighted by their amplitudes. That's the audio.
    audio = (amps * torch.sin(phases_k)).sum(-1)               # [B, n_samples]
    return audio


# --------------------------------------------------------------------------
# The SECOND DDSP component: FILTERED NOISE.
# Harmonics make tonal sound; they cannot make hiss/rasp/buzz. Real birds have
# plenty of that. So we generate white noise and shape its spectrum over time
# with a per-frame filter the model controls. Together, harmonic + noise can
# represent almost any natural sound.
# --------------------------------------------------------------------------
NOISE_NFFT = 256
N_NOISE_BANDS = NOISE_NFFT // 2 + 1        # 129 filter knobs per frame


def filtered_noise(magnitudes: torch.Tensor, n_samples: int,
                   hop: int = 64) -> torch.Tensor:
    """Time-varying filtered noise.

    magnitudes: [batch, frames, N_NOISE_BANDS] — the desired loudness of noise
    in each frequency band, at each moment (all >= 0). We colour white noise by
    multiplying its spectrogram by these magnitudes, then invert back to audio.
    """
    batch = magnitudes.shape[0]
    device = magnitudes.device
    window = torch.hann_window(NOISE_NFFT, device=device)

    white = torch.rand(batch, n_samples, device=device) * 2 - 1
    spec = torch.stft(white, n_fft=NOISE_NFFT, hop_length=hop, win_length=NOISE_NFFT,
                      window=window, center=True, return_complex=True)   # [B, bins, T]

    mag = magnitudes.transpose(1, 2)                                     # [B, bins, frames]
    if mag.shape[-1] != spec.shape[-1]:                                  # align frame counts
        mag = F.interpolate(mag, size=spec.shape[-1], mode="linear", align_corners=True)

    coloured = spec * mag                                                # shape the noise
    return torch.istft(coloured, n_fft=NOISE_NFFT, hop_length=hop, win_length=NOISE_NFFT,
                       window=window, center=True, length=n_samples)


def synthesize(f0, amplitude, harmonic_distribution, noise_magnitudes,
               n_samples: int) -> torch.Tensor:
    """Full DDSP synth: harmonic tones + filtered noise. This is the instrument."""
    harm = harmonic_synth(f0, amplitude, harmonic_distribution, n_samples)
    noise = filtered_noise(noise_magnitudes, n_samples)
    return harm + noise


# --------------------------------------------------------------------------
# ML-2 self-test: prove it makes sound AND that gradients flow through it.
# --------------------------------------------------------------------------
if __name__ == "__main__":
    import soundfile as sf

    frames, seconds = 100, 2.0
    n_samples = int(seconds * SAMPLE_RATE)

    # Hand-made control signals (in ML-3 a NETWORK will produce these instead):
    # a pitch that glides 300 -> 700 Hz, steady loudness, richer-then-purer timbre.
    t = torch.linspace(0, 1, frames)
    f0 = (300 + 400 * t).unsqueeze(0)                          # [1, frames]
    amplitude = torch.full((1, frames), 0.5)                   # [1, frames]

    # Make the harmonic knobs a LEARNABLE-style tensor so we can show gradients.
    harmonic_distribution = torch.randn(1, frames, N_HARMONICS, requires_grad=True)

    audio = harmonic_synth(f0, amplitude, harmonic_distribution, n_samples)

    # --- proof of differentiability: define a fake "loss" and backprop ---
    loss = audio.pow(2).mean()            # any scalar function of the output
    loss.backward()                       # gradients flow back THROUGH the synth
    grad_norm = harmonic_distribution.grad.norm().item()

    sf.write("out/synth_test.wav", audio.detach().squeeze().numpy(), SAMPLE_RATE)
    print(f"generated audio: {audio.shape} samples, peak {audio.abs().max():.2f}")
    print(f"gradient flowed through synth: grad norm = {grad_norm:.4f} (non-zero = differentiable)")
    print("wrote out/synth_test.wav  (a gliding harmonic tone)")
