# Mobile App PRD — Birdsong

**Status:** Draft v0.1
**Owner:** Yagiz
**Platforms:** iOS and Android
**Last updated:** 2026-07-28

---

## 1. Scope

This document covers the mobile application: messaging, encoding/decoding, species identification, unlock and verification logic, permissions, and architecture. Marketing site and web companion are covered in `website.md`.

---

## 2. Core user flows

### 2.1 Send a birdsong message

1. User opens a conversation and selects the species voice to speak in (defaults to last used).
2. User holds the record button and speaks. Release ends recording.
3. App runs speech-to-text, encodes the text into a birdsong motif sequence for the selected species, and synthesizes audio.
4. **Preview screen:** user sees the transcribed text and hears the generated birdsong before sending. They can re-record or edit the text.
5. User sends. Audio + encoded payload + decoded text are transmitted.

**Requirement:** the preview step is mandatory in MVP. Without it, a speech-to-text error silently becomes a wrong message.

### 2.2 Receive a birdsong message

1. Message appears in the conversation as a birdsong bubble with a waveform indicator and species badge.
2. On playback, birdsong audio plays and the decoded text appears synchronized beneath it, subtitle-style.
3. A "text only" toggle lets the user read without audio (meetings, quiet contexts).
4. If decode confidence is low, the message is marked as such rather than silently showing possibly-wrong text.

### 2.3 Field discovery (unlock a species)

1. User taps Identify and grants microphone (and, if not yet granted, location) permission.
2. App records ambient audio and runs species identification.
3. Verification runs (see §7). Result is one of:
   - **Verified** → species unlocked (free for basic, discounted for premium)
   - **Uncertain** → queued for review, or offered at a reduced discount
   - **Rejected** → user is told the recording could not be verified and offered the purchase path
4. On success, a discovery card is shown (species name, where and when found) and the species is added to the user's library.

### 2.4 Purchase a species

1. User browses the species catalog, filtered by owned / unlockable / premium.
2. Taps a locked species → detail sheet with sample audio, tier, price, and whether it is findable in their region.
3. Purchase via platform IAP. Unlock is immediate and account-bound.

---

## 3. Screens

| Screen | Purpose |
|---|---|
| Conversation list | Recent chats, unread state |
| Conversation | Message thread, record button, species selector |
| Send preview | Transcript, generated audio, re-record / edit / send |
| Identify | Live recording UI, level meter, result state |
| Discovery result | Species found, verification outcome, unlock action |
| Species catalog | Grid of all species; owned, unlockable, premium |
| Species detail | Sample audio, tier, price, regional availability |
| My library | Owned species, discovery history |
| Settings | Permissions, audio preferences, account, privacy |

---

## 4. Encoding and decoding

### 4.1 Approach

The system does **not** do acoustic style transfer. It encodes text into a designed symbol alphabet rendered as birdsong-like audio, then decodes it back to text.

**Pipeline (send):**
```
speech → STT → normalized text → symbol sequence → motif sequence
       → species-specific synthesis → audio file
```

**Pipeline (receive):**
```
audio file → segmentation → motif classification → symbol sequence
           → text → displayed as subtitle
```

### 4.2 Symbol alphabet

- Encoding operates on syllables/phonemes rather than characters, to keep message duration acceptable.
- Each symbol maps to a motif: a defined combination of frequency contour, duration, and inter-element gap, expressed within the acoustic range and phrasing style of the selected species.
- Each species has its own motif set derived from that species' real acoustic characteristics, so encoded output is recognizably "that bird."
- The alphabet must include delimiters (message start, symbol boundary, message end) and a checksum region for decode integrity.

### 4.3 Decode reliability

- The decoded text is transmitted alongside the audio in MVP. The audio is the experience; the transmitted text is the guarantee.
- The acoustic decoder still runs on the receiving device and its output is compared against the transmitted text. Divergence is logged as a decode-accuracy metric.
- **Rationale:** shipping a product whose comprehension depends entirely on a classifier operating over compressed, noisy audio is a launch risk. Decoding from audio alone becomes the default only once measured accuracy justifies it.

### 4.4 Requirements

- Encode + synthesize for a 10-second utterance completes in under 3 seconds on mid-range hardware.
- Generated audio is under 500 KB per 10 seconds of speech.
- Message length cap in MVP: 30 seconds of speech.

---

## 5. Species identification

- Identification runs on a bird sound classification model. BirdNET is the reference architecture and a candidate base model.
- **Licensing constraint:** BirdNET source code is MIT. Model weights for the main releases are CC BY-NC-SA 4.0 (non-commercial only). The V3.0 developer preview models are CC BY-SA 4.0, which permits commercial use with attribution ("Powered by BirdNET"). Written confirmation from Cornell should be obtained before commercial launch.
- Model input: 3-second audio chunks. Location and time-of-year are supported as inputs and feed the plausibility check in §7.
- Where the base model does not cover a species in our catalog (notably exotic species found in zoos and aviaries), we extend coverage by fine-tuning a classification head on the base model's embeddings, using licensed or self-recorded audio.
- Identification runs on-device where feasible, with a server fallback for the extended classifier.

---

## 6. Species catalog and content pipeline

Each species in the catalog requires:

- Reference audio samples (licensed, public-domain, or self-recorded — provenance recorded per asset)
- A derived motif set for encoding
- A synthesis profile
- Catalog metadata: common and scientific name, tier, regional range, seasonality, artwork

**Requirement:** this must be a repeatable pipeline with tooling, not a manual process. Content production cost scales linearly with catalog size and becomes the binding constraint on growth well before engineering does.

Species names and taxonomic data are not copyrightable. Licensing obligations attach to audio recordings and artwork, not to the names.

---

## 7. Unlock verification (anti-fraud)

The threat: a user plays a recording of a bird from a speaker and claims it as a field discovery, obtaining a paid species for free or at a discount.

Verification produces a **confidence score (0–100)** from weighted signals across four layers. No single signal is decisive.

### Layer 1 — Acoustic signal
- Model confidence score for the identified species
- Replay detection: playback through a speaker leaves characteristic artifacts (frequency response distortion, room reverb signature) distinguishable from direct field capture
- Ambient consistency: genuine field recordings carry layered natural background (wind, foliage, other species); studio or stream recordings do not

### Layer 2 — Contextual cross-check
- Geographic plausibility: is this species expected at this location, in this season?
- Temporal plausibility: is this species active at this hour?
- **Zoo / aviary allowlist:** if the recording location falls within a known zoo, aviary, or bird park, the geographic plausibility check is bypassed — and treated as a mild *positive* signal, since finding an exotic species there is expected. All other layers continue to apply.

### Layer 3 — Behavioral anomaly
- Rate limiting: an implausible density of rare-species discoveries in a short window is flagged
- Audio fingerprint deduplication: the same recording submitted across multiple accounts is direct evidence of a shared fake
- Device and account cross-checks

### Layer 4 — Outcome banding

| Score | Outcome |
|---|---|
| High (≥85) | Unlock granted — free (basic) or full discount (premium) |
| Medium (50–84) | Reduced discount, or queued for review with a stated resolution window |
| Low (<50) | Rejected, with a clear message and the purchase path offered |

**Design principle:** graded outcomes, not binary pass/fail. A legitimate user with a poor recording should not be treated as a fraudster.

**Implementation sequencing:**
1. MVP — model confidence + geographic/seasonal plausibility (supported natively by the base model, no extra work)
2. v1.1 — rate limiting + fingerprint deduplication (no ML required, high yield)
3. v2 — replay detection classifier (requires a training set of genuine field recordings vs. speaker playback)
4. v2+ — device sensor cross-checks

Early fraud will mostly be low-effort (sharing a recording file). Deduplication and rate limiting catch most of it before any spoofing model exists.

---

## 8. Permissions and privacy

### 8.1 Microphone
Requested at first record or first identify, with an in-app explanation preceding the system dialog.

### 8.2 Location
- **Foreground only** ("When In Use" / `ACCESS_FINE_LOCATION`). Background location is never requested.
- Captured as a **single snapshot at the moment of recording**, not as continuous tracking.
- Requested at the first identification attempt, not at onboarding.
- A pre-permission screen explains the purpose before the system dialog appears:

  > "To unlock birds you find in the wild for free, we need to check your location at the moment you record. Your location isn't tracked — it's used once, for that recording."

### 8.3 Graceful degradation
If location permission is denied, identification still works. Only the free/discounted unlock path is unavailable, and the app says so plainly rather than blocking the feature.

### 8.4 Data handling
- Location snapshots are attached to a discovery record only for verification purposes.
- If discovery history or a "discovery map" feature is built, retained location data becomes personal data under KVKK and GDPR, requiring explicit consent, a stated retention period, and deletion tooling. Legal review is required before shipping any feature that retains location history.
- Audio recordings submitted for identification: define and disclose a retention period. If recordings are retained for model improvement, that requires separate, opt-in consent.

---

## 9. Architecture

**Client (iOS / Android)**
- Audio capture and playback
- On-device STT where available, server STT fallback
- On-device identification model (quantized) with server fallback
- Encoding/synthesis engine
- Local decoder for accuracy measurement
- Local cache of owned species and their motif sets

**Backend**
- Auth and accounts
- Messaging service (delivery, storage, read state)
- Verification service (scoring across all four layers, allowlist lookups, fingerprint store)
- Entitlements service (owned species, purchase receipt validation)
- Catalog service (species metadata, motif sets, asset delivery)
- Extended classifier inference endpoint

**Data**
- `users`, `conversations`, `messages`
- `species` (metadata, tier, range, seasonality, asset references)
- `unlocked_species` (user × species, unlock method, timestamp) — the shared contract between the identification system and the messaging system
- `discoveries` (identification events, verification score, outcome)
- `audio_fingerprints`
- `zoo_locations` (allowlist: coordinates, radius, name)

**Module boundary:** identification and messaging are independent subsystems that communicate only through `unlocked_species`. Identification answers "which species did this user prove they found." Messaging answers "which voices may this user speak in." Keeping them decoupled keeps both testable.

---

## 10. Non-functional requirements

- Message send end-to-end (record release → delivered) under 5 seconds on a normal connection
- Identification result returned within 10 seconds
- App cold start under 2 seconds
- Offline: reading existing messages and browsing the library works offline; sending and identifying require connectivity in MVP
- Accessibility: subtitles are the primary comprehension path and must meet contrast and text-scaling requirements; the app must be usable with audio muted

---

## 11. Open questions

- On-device vs. server-side encoding: on-device is faster and cheaper, but ships the motif alphabet to the client where it can be extracted. Does that matter?
- Does the transmitted-text fallback ever get removed, or is it permanent?
- Cross-device entitlement restore on platform switch (iOS → Android)
- Minimum recording length required for a valid identification attempt
- Handling of multi-species recordings (several birds audible at once)
