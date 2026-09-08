# Website PRD — Birdsong

**Status:** Draft v0.1
**Owner:** Yagiz
**Last updated:** 2026-07-28

---

## 1. Scope and purpose

The website is not a second version of the product. It exists to do three jobs, in priority order:

1. **Convert** — explain the concept fast enough that a visitor installs the app.
2. **Catch shared links** — a birdsong message shared outside the app must land somewhere that plays it and explains what it is. This is the primary acquisition channel.
3. **Support** — privacy policy, terms, help, and account/data requests, some of which are legally required and some of which app store review will check for.

Anything beyond these is out of scope until the app has retention worth supporting.

---

## 2. Site map

| Route | Purpose | Priority |
|---|---|---|
| `/` | Landing page — concept, demo, install CTAs | MVP |
| `/m/:id` | Shared message player (public link landing) | MVP |
| `/species` | Species catalog, browsable | MVP |
| `/species/:slug` | Individual species page | MVP |
| `/lab` | Research write-ups from building the voices, one per experiment | Post-MVP, shipped |
| `/lab/:slug` | One entry; three so far, a voice space per trained bird | Post-MVP, shipped |
| `/privacy` | Privacy policy (KVKK / GDPR) | MVP — required |
| `/terms` | Terms of service | MVP — required |
| `/support` | Help, FAQ, contact | MVP — required |
| `/data-request` | Data access and deletion requests | MVP — required |
| `/account` | Entitlements, purchase history, device management | v1.1 |
| `/blog` | Content marketing, species features, seasonal posts | v1.1 |
| `/press` | Press kit, assets, contact | v1.1 |

---

## 3. Landing page

**The hard requirement:** a visitor who has never heard of this must understand it within one screen and roughly five seconds.

**Above the fold**
- One-line proposition: your voice, in birdsong.
- An interactive demo: a short pre-recorded human sentence with a play button, and the same sentence rendered in two or three different bird voices, with the decoded text shown as subtitle. No signup, no install, plays immediately.
- Install buttons (App Store, Google Play).

**Below the fold, in order**
1. **How it works** — three steps: speak, it becomes birdsong, they hear it and read it.
2. **Collect the voices** — the field-discovery mechanic explained. This is the differentiator and deserves more space than the messaging feature.
3. **Species preview** — a grid of species with playable samples, linking into `/species`.
4. **Credibility** — species identification built on established bioacoustic models; attribution where licensing requires it.
5. **Install CTA** — repeated.

**Requirements**
- Audio must not autoplay.
- Every demo has a visible text transcript; the page is fully usable with sound off.
- Mobile-first. Most traffic will arrive on a phone from a shared link or social post.
- Largest Contentful Paint under 2.5s; audio assets lazy-loaded on interaction.

---

## 4. Shared message player (`/m/:id`)

The highest-leverage page on the site. When a user shares a birdsong message to a platform where the recipient has no app, this page is what the recipient sees.

**Behavior**
- Plays the birdsong audio.
- Shows the decoded subtitle synchronized with playback.
- Shows the species used, with a link to that species page.
- Clear install CTA framed as "reply in birdsong."
- Open Graph and Twitter Card metadata so the link previews correctly with the species name and artwork.

**Privacy and control**
- Sharing outside the app is **opt-in per message** by the sender. Messages are private by default.
- Shared links are unguessable and can be revoked by the sender.
- Shared links expire after a configurable period (default 30 days).
- The recipient's identity is never exposed on the public page.

---

## 5. Species catalog (`/species`, `/species/:slug`)

Serves two purposes: browsing for prospective users, and SEO. Species names are high-intent, low-competition search terms and each species page is a legitimate content asset.

**Catalog page**
- Grid of all species with artwork and a sample audio play button.
- Filterable by tier, region, and season.
- Indicates which species are findable in the wild versus purchase-only.

**Species page**
- Species artwork, common and scientific name.
- Sample of the real bird's call, and a sample of an encoded message in that voice.
- Where and when it can be found (region, season) — supports the discovery loop.
- Tier and unlock paths.
- Attribution for audio and imagery, as licensing requires.

**Requirements**
- Server-rendered for indexing.
- Structured data markup for each species page.
- Audio credits and licensing attributions rendered from asset metadata, not hand-maintained.

---

## 6. Legal and support pages

These are not optional and are checked during app store review.

- **Privacy policy** must specifically cover: microphone use, location capture at recording time, retention of audio submitted for identification, whether recordings are used for model training, third-party processors, and the KVKK/GDPR rights available to users.
- **Data request page** must provide a working route to access and deletion. If discovery history with location is retained, this becomes a real operational obligation, not a form that goes nowhere.
- **Terms** must cover the nature of purchased species entitlements — what a user is buying, whether it is permanent, and what happens if a species is removed from the catalog.
- **Support/FAQ** should address the questions the app itself will generate: why a discovery was rejected, why location is requested, what happens if permission is denied, how to restore purchases.

Legal review is required on all four before launch. These pages are drafted from templates but must not ship as templates.

---

## 7. Account management (v1.1)

Deferred, but the shape:
- Sign in with the same identity used in the app.
- View owned species and how each was unlocked.
- Purchase history (records only — purchases themselves stay on platform IAP).
- Device management and sign-out.
- Self-service data export and account deletion.

**Constraint:** digital goods for the mobile app cannot be sold through the website to circumvent platform commission. Do not design toward this.

---

## 8. Technical requirements

- Static or server-rendered; no heavy client framework needed for MVP.
- The message player and species pages require server rendering for link previews and indexing.
- Audio served from a CDN, streamed rather than fully downloaded on page load.
- Analytics limited to aggregate, non-identifying measurement, disclosed in the privacy policy. Cookie consent where required by jurisdiction.
- Localization: Turkish and English at minimum if launching in Türkiye first. The species catalog needs localized common names, which is real content work, not string translation.

---

## 9. Success metrics

- Landing page → install conversion rate
- Shared message page → install conversion rate (expected to be the highest-converting path — the visitor arrived because a friend sent them something)
- Demo play rate on the landing page, and its correlation with install
- Organic search traffic to species pages
- Support deflection: FAQ views relative to support contacts

---

## 10. Open questions

- Should the shared player let a non-user reply once without installing, as an acquisition hook? Tempting, but it adds abuse surface and unauthenticated write paths.
- Does the website need a species catalog before the app has enough species to make it interesting?
- Web-based identification (upload a recording, see the species) as a top-of-funnel tool — valuable, but it exposes the identification pipeline to unauthenticated load and would need its own rate limiting.
