# Overview PRD — Birdsong (working name)

**Status:** Draft v0.1
**Owner:** Yagiz
**Last updated:** 2026-07-28

---

## 1. Product summary

Birdsong is a mobile messaging app that encodes a user's spoken message into synthesized birdsong and transmits it to another user, who hears the birdsong and reads the decoded text alongside it.

The bird species a user can "speak in" is a collectible, unlockable asset. Species are unlocked two ways:

1. **Purchase** — paid unlock through in-app purchase.
2. **Field discovery** — the user records a real bird in the wild, the app identifies the species, and (subject to verification) the species is unlocked free or at a discount.

The second path is the product's differentiator. It ties a digital messaging feature to a real-world action, creating a retention loop that pure novelty apps lack.

---

## 2. Problem and positioning

**Honest framing:** this product does not solve a utility problem. Nobody needs birdsong messaging instead of a voice note. It competes on *play, collection, and discovery*, not efficiency.

The positioning is therefore closer to Pokémon GO, Shazam, and iNaturalist than to WhatsApp or Telegram:

| Reference | What we borrow |
|---|---|
| Shazam | "Point your phone at a sound, learn what it is" moment |
| Pokémon GO | Go outside, collect, the collection has in-app value |
| iNaturalist | Real biodiversity data, credible species catalog |
| Snapchat filters | Playful transformation of your own expression |

**Positioning statement:** A messaging app where your voice becomes birdsong — and the birds you find in the real world become the voices you can speak in.

---

## 3. Target users

**Primary — collectors / casual gamers (18–34).**
Motivated by unlocking, completing sets, and showing rare finds to friends. They will drive most revenue.

**Secondary — birders and nature hobbyists.**
Already carry a phone into the field to identify birds. Birdsong gives them a reason to keep the app after identification. Higher credibility demands: species data must be accurate or they will reject the product.

**Tertiary — novelty / social sharers.**
Use it for a week, produce viral content, churn. Valuable for acquisition, not for retention. Do not design for them.

---

## 4. Core loops

**Messaging loop (daily):**
speak → encode to birdsong → send → recipient hears birdsong + reads subtitle → replies

**Collection loop (weekly, seasonal):**
hear a real bird → record → identify → verify → unlock species → new voice available in messaging → show friends

**Monetization loop:**
want a species you cannot find locally → buy it, or travel/wait for it

The collection loop is what makes the messaging loop repeat. If the collection loop is weak, the product degrades into a one-week novelty.

---

## 5. Monetization

**Model:** freemium with in-app purchases (Apple IAP / Google Play Billing mandatory — no external payment rails for digital goods).

**Species tiers:**

| Tier | Examples | Unlock paths |
|---|---|---|
| Starter | Sparrow, pigeon, crow | Free by default |
| Basic | Swallow, blackbird, common regional species | Free via verified field identification, or small purchase |
| Premium | Nightingale, hoopoe, kingfisher, exotics | Discounted via verified field identification, or full purchase |
| Seasonal / limited | Migratory species, event-tied releases | Time-windowed availability |

**Additional revenue candidates (post-MVP):** subscription bundling all current species, cosmetic message themes, gifting a species to a friend.

**Key design tension:** field discovery must feel genuinely rewarding without cannibalizing purchase revenue. The discount-not-free rule for premium species is the current compromise, and its rate is a tunable parameter to be calibrated against real data.

---

## 6. Success metrics

**Activation:** % of new users who send a birdsong message within 24h; % who complete one field identification within 7 days.

**Retention:** D1 / D7 / D30. D30 is the honest verdict on whether the collection loop works. Anything under 10% D30 means the loop failed and the product is a novelty.

**Collection health:** median species owned per active user; ratio of field-unlocked to purchased species (a healthy product shows both, not one).

**Monetization:** conversion to first purchase; ARPPU; % of revenue from premium tier.

**Integrity:** fraudulent unlock rate (see anti-fraud section in app.md); false rejection rate on legitimate field recordings — this one is a UX metric, not just a security one.

**Comprehension (product-specific):** decode accuracy — % of sent messages where the decoded text matches the sender's intended text. Below ~90% the messaging premise breaks.

---

## 7. Scope and roadmap

**MVP (target: shippable, deliberately narrow)**
- 1:1 messaging, record-then-send (no live streaming)
- Speech → text → encode → synthesized birdsong → send
- Receiver: playback + synchronized decoded subtitle
- 5–8 species total: 3 starter (free), 3–5 basic
- Field identification with basic verification (model confidence + location/season plausibility)
- Sender-side preview before sending

**v1.1**
- Species catalog expansion (20–30)
- Premium tier and purchase flows
- Rate-limiting and behavioral anomaly detection
- Zoo / aviary location allowlist

**v2**
- Replay-attack (spoofing) detection model
- Group messaging
- Web companion (see website.md)
- Seasonal and limited-time species

**v2+ (explicitly deferred)**
- Real-time streaming translation
- Custom/user-trained species
- Social feed, public profiles

**Out of scope indefinitely:** serious/professional communication use cases, offline-first sync, voice calling.

---

## 8. Key risks

| Risk | Severity | Mitigation |
|---|---|---|
| Retention collapse after novelty wears off | High | Collection loop is the primary mitigation; measure D30 early and honestly |
| Decode accuracy too low to feel like real messaging | High | Subtitle always shown; sender preview; treat decode accuracy as a release gate |
| Fraudulent unlocks erode paid tier | Medium–High | Layered verification (app.md §7) |
| Content production cost per species scales linearly | Medium | Build a species-onboarding pipeline before catalog expansion, not after |
| Model licensing (BirdNET) restricts commercial use | Medium | Older BirdNET models are CC BY-NC-SA (non-commercial). V3.0 preview models are CC BY-SA (commercial permitted with attribution). Confirm in writing with Cornell before launch |
| Location permission refusal blocks the collection loop | Medium | Identification works without location; only the discount/free unlock requires it |
| App Store rejection over location or IAP handling | Medium | Foreground-only location, clear purpose strings, all digital goods via platform IAP |

---

## 9. Open decisions

- Product name and brand direction (Birdsong is a placeholder)
- Premium field-discovery discount rate (currently assumed ~50%)
- Whether species unlock is permanent or account-bound across devices (assume permanent + account-bound)
- Subscription vs. à la carte as the primary monetization model
- Launch market: Türkiye first, or English-speaking market first

---

## 10. Related documents

- `app.md` — mobile application PRD
- `website.md` — web presence and companion experience PRD
